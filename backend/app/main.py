"""RetoBox API — FastAPI application.

Implements the REST contract defined in CONTRACT.md (all routes under /api).
Persistence is SQLite via the standard-library driver; see app/database.py.

Access model
------------
* Public preset collections are readable by everyone.
* Creating / editing collections and challenges requires a logged-in account
  (``require_account``) and ownership of the collection.
* Players, word groups, draw, reset and stats are scoped to the caller's
  ``owner_key`` (``require_owner``): an account or an anonymous guest.
"""

import json
import os
import random
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Query, Response

from app.auth import Owner, require_account, require_owner, resolve_owner
from app.database import (
    _lock,
    challenge_row_to_dict,
    collection_row_to_dict,
    get_connection,
    init_db,
    user_row_to_dict,
    word_group_row_to_dict,
)
from app.models import (
    Challenge,
    ChallengeCreate,
    ChallengeUpdate,
    Collection,
    CollectionCreate,
    CollectionUpdate,
    DrawRequest,
    DrawResult,
    Health,
    ImportGroupsRequest,
    ImportRequest,
    ImportResult,
    ResetResult,
    Stats,
    User,
    UserCreate,
    WordGroup,
    WordGroupCreate,
    WordGroupUpdate,
)
from app.routes_auth import router as auth_router
from app.seed import seed_presets

# Pleasant palette assigned to users who do not provide a color. Rotated by
# the current user count so consecutive users get distinct, varied colors.
COLOR_PALETTE = [
    "#FF6B6B",  # coral red
    "#4ECDC4",  # turquoise
    "#FFD93D",  # sunny yellow
    "#6BCB77",  # green
    "#4D96FF",  # blue
    "#FF8FB1",  # pink
    "#B983FF",  # purple
    "#FF9F45",  # orange
    "#1FAB89",  # emerald
    "#F46060",  # salmon
    "#5C7AEA",  # indigo
    "#00C2A8",  # teal
]

# Factor de decaimiento de probabilidad para cartas repetibles. El peso de una
# carta en el sorteo es REPEAT_DECAY ** (veces ya sacada). Con 0.1, una carta
# vista una vez es 10x menos probable que una sin ver, vista dos veces 100x
# menos, etc. Así las repetibles que aún no han salido se priorizan con fuerza y
# prácticamente no se repite ninguna hasta que van saliendo las demás (verificado
# por simulación: reparto casi uniforme y orden aleatorio). Configurable por env
# var: 1.0 = uniforme (sin anti-repetición); 0.0 = rotación pura (no repite hasta
# agotar todas). Valores bajos (0.05–0.1) = muy anti-repetición pero aleatorio.
REPEAT_DECAY = float(os.environ.get("REPEAT_DECAY", "0.1"))

# Orígenes permitidos para CORS. Vacío = solo mismo origen (nginx / proxy de
# Vite), que es el despliegue normal. Con cookies no se puede usar "*".
CORS_ORIGINS = [o for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    seed_presets()
    yield


app = FastAPI(title="RetoBox API", version="2.0.0", lifespan=lifespan)

if CORS_ORIGINS:
    from fastapi.middleware.cors import CORSMiddleware

    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth_router)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Collection access helpers (caller holds ``_lock``)
# ---------------------------------------------------------------------------

def _visible_collection(
    conn: sqlite3.Connection, collection_id: int, owner: Owner | None
) -> sqlite3.Row:
    """A collection the caller may read: a preset or one of their own."""
    row = conn.execute(
        "SELECT * FROM collections WHERE id = ?", (collection_id,)
    ).fetchone()
    if row is None or (
        row["owner_id"] is not None
        and (owner is None or row["owner_id"] != owner.account_id)
    ):
        raise HTTPException(status_code=404, detail="Colección no encontrada.")
    return row


def _owned_collection(
    conn: sqlite3.Connection, collection_id: int, owner: Owner
) -> sqlite3.Row:
    """A collection the caller may modify (must be theirs; presets are read-only)."""
    row = _visible_collection(conn, collection_id, owner)
    if row["owner_id"] is None:
        raise HTTPException(
            status_code=403, detail="Las colecciones públicas no se pueden modificar."
        )
    return row


def _default_collection_id(conn: sqlite3.Connection, owner: Owner) -> int:
    """The account's first collection (created at registration)."""
    row = conn.execute(
        "SELECT id FROM collections WHERE owner_id = ? ORDER BY id ASC LIMIT 1",
        (owner.account_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Colección no encontrada.")
    return row["id"]


def _owned_challenge(
    conn: sqlite3.Connection, challenge_id: int, owner: Owner
) -> sqlite3.Row:
    row = conn.execute(
        "SELECT c.* FROM challenges c JOIN collections k ON k.id = c.collection_id "
        "WHERE c.id = ? AND k.owner_id = ?",
        (challenge_id, owner.account_id),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Reto no encontrado.")
    return row


def _visible_collection_filter(owner: Owner | None) -> tuple[str, list]:
    """SQL clause selecting collections the caller can read."""
    if owner is None or owner.account_id is None:
        return "owner_id IS NULL", []
    return "(owner_id IS NULL OR owner_id = ?)", [owner.account_id]


# Selección de retos con el draw_count del dueño actual (0 si nunca le salió).
_CHALLENGE_WITH_STATE = (
    "SELECT c.*, COALESCE(ds.draw_count, 0) AS draw_count FROM challenges c "
    "LEFT JOIN draw_state ds ON ds.challenge_id = c.id AND ds.owner_key = ? "
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/api/health", response_model=Health)
def health() -> Health:
    return Health(status="ok")


# ---------------------------------------------------------------------------
# Collections — presets públicas + las de la cuenta
# ---------------------------------------------------------------------------

@app.get("/api/collections", response_model=list[Collection])
def list_collections(owner: Owner | None = Depends(resolve_owner)) -> list[Collection]:
    conn = get_connection()
    clause, params = _visible_collection_filter(owner)
    with _lock:
        rows = conn.execute(
            f"SELECT * FROM collections WHERE {clause} ORDER BY owner_id IS NOT NULL, id ASC",
            params,
        ).fetchall()
    return [Collection(**collection_row_to_dict(r)) for r in rows]


@app.post("/api/collections", response_model=Collection, status_code=201)
def create_collection(
    payload: CollectionCreate, owner: Owner = Depends(require_account)
) -> Collection:
    conn = get_connection()
    with _lock:
        cur = conn.execute(
            "INSERT INTO collections (name, owner_id, created_at) VALUES (?, ?, ?)",
            (payload.name, owner.account_id, _now()),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM collections WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
    return Collection(**collection_row_to_dict(row))


@app.put("/api/collections/{collection_id}", response_model=Collection)
def update_collection(
    collection_id: int,
    payload: CollectionUpdate,
    owner: Owner = Depends(require_account),
) -> Collection:
    conn = get_connection()
    with _lock:
        row = _owned_collection(conn, collection_id, owner)
        if payload.name is not None:
            conn.execute(
                "UPDATE collections SET name = ? WHERE id = ?",
                (payload.name, collection_id),
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM collections WHERE id = ?", (collection_id,)
            ).fetchone()
    return Collection(**collection_row_to_dict(row))


@app.delete("/api/collections/{collection_id}", status_code=204)
def delete_collection(
    collection_id: int, owner: Owner = Depends(require_account)
) -> Response:
    conn = get_connection()
    with _lock:
        _owned_collection(conn, collection_id, owner)
        # Los retos (y su draw_state) caen en cascada por la FK.
        conn.execute("DELETE FROM collections WHERE id = ?", (collection_id,))
        conn.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Challenges
# ---------------------------------------------------------------------------

@app.get("/api/challenges", response_model=list[Challenge])
def list_challenges(
    collection_id: int | None = Query(default=None),
    owner: Owner | None = Depends(resolve_owner),
) -> list[Challenge]:
    conn = get_connection()
    owner_key = owner.key if owner else ""
    with _lock:
        if collection_id is not None:
            _visible_collection(conn, collection_id, owner)
            rows = conn.execute(
                _CHALLENGE_WITH_STATE + "WHERE c.collection_id = ? ORDER BY c.id ASC",
                (owner_key, collection_id),
            ).fetchall()
        else:
            clause, params = _visible_collection_filter(owner)
            rows = conn.execute(
                _CHALLENGE_WITH_STATE
                + f"WHERE c.collection_id IN (SELECT id FROM collections WHERE {clause}) "
                "ORDER BY c.id ASC",
                [owner_key, *params],
            ).fetchall()
    return [Challenge(**challenge_row_to_dict(r)) for r in rows]


def _insert_challenge(
    conn: sqlite3.Connection, ch: ChallengeCreate, collection_id: int, now: str
) -> int:
    cur = conn.execute(
        "INSERT INTO challenges "
        "(title, description, required_users, involved_users, repeatable, created_at, collection_id) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            ch.title,
            ch.description,
            ch.required_users,
            ch.involved_users,
            int(ch.repeatable),
            now,
            collection_id,
        ),
    )
    return cur.lastrowid


@app.post("/api/challenges", response_model=Challenge, status_code=201)
def create_challenge(
    payload: ChallengeCreate, owner: Owner = Depends(require_account)
) -> Challenge:
    conn = get_connection()
    with _lock:
        if payload.collection_id is None:
            collection_id = _default_collection_id(conn, owner)
        else:
            collection_id = _owned_collection(conn, payload.collection_id, owner)["id"]
        new_id = _insert_challenge(conn, payload, collection_id, _now())
        conn.commit()
        row = conn.execute(
            _CHALLENGE_WITH_STATE + "WHERE c.id = ?", (owner.key, new_id)
        ).fetchone()
    return Challenge(**challenge_row_to_dict(row))


@app.post("/api/challenges/import", response_model=ImportResult)
def import_challenges(
    payload: ImportRequest, owner: Owner = Depends(require_account)
) -> ImportResult:
    """Importa retos a una colección propia, evitando duplicados.

    Un reto se considera duplicado si su título (normalizado: sin espacios al
    borde y sin distinguir mayúsculas) ya existe EN ESA COLECCIÓN; en ese caso se
    omite. También se descartan duplicados dentro del propio fichero.
    """
    conn = get_connection()
    now = _now()
    imported = 0
    skipped = 0
    with _lock:
        if payload.collection_id is None:
            collection_id = _default_collection_id(conn, owner)
        else:
            collection_id = _owned_collection(conn, payload.collection_id, owner)["id"]

        # Títulos ya presentes en esa colección (normalizados) para descartar dups.
        seen = {
            r["title"].strip().lower()
            for r in conn.execute(
                "SELECT title FROM challenges WHERE collection_id = ?",
                (collection_id,),
            ).fetchall()
        }
        for ch in payload.challenges:
            key = ch.title.strip().lower()
            if key in seen:
                skipped += 1
                continue
            _insert_challenge(conn, ch, collection_id, now)
            seen.add(key)
            imported += 1
        conn.commit()
    return ImportResult(imported=imported, skipped=skipped)


@app.put("/api/challenges/{challenge_id}", response_model=Challenge)
def update_challenge(
    challenge_id: int,
    payload: ChallengeUpdate,
    owner: Owner = Depends(require_account),
) -> Challenge:
    conn = get_connection()
    with _lock:
        row = _owned_challenge(conn, challenge_id, owner)

        # model_fields_set distingue "campo no enviado" de "campo = null", lo que
        # permite limpiar involved_users mandando explícitamente null.
        sent = payload.model_fields_set
        fields: list[str] = []
        values: list = []
        if payload.title is not None:
            fields.append("title = ?")
            values.append(payload.title)
        if payload.description is not None:
            fields.append("description = ?")
            values.append(payload.description)
        if payload.required_users is not None:
            fields.append("required_users = ?")
            values.append(payload.required_users)
        if "involved_users" in sent:
            fields.append("involved_users = ?")
            values.append(payload.involved_users)
        if "repeatable" in sent and payload.repeatable is not None:
            fields.append("repeatable = ?")
            values.append(int(payload.repeatable))

        # involved_users >= required_users si ambos quedan definidos tras el update.
        new_required = (
            payload.required_users
            if payload.required_users is not None
            else row["required_users"]
        )
        new_involved = (
            payload.involved_users
            if "involved_users" in sent
            else row["involved_users"]
        )
        if new_involved is not None and new_involved < new_required:
            raise HTTPException(
                status_code=422,
                detail="Las personas involucradas no pueden ser menos que las que realizan el reto.",
            )

        if fields:
            values.append(challenge_id)
            conn.execute(
                f"UPDATE challenges SET {', '.join(fields)} WHERE id = ?",
                values,
            )
            conn.commit()

        row = conn.execute(
            _CHALLENGE_WITH_STATE + "WHERE c.id = ?", (owner.key, challenge_id)
        ).fetchone()
    return Challenge(**challenge_row_to_dict(row))


@app.delete("/api/challenges/{challenge_id}", status_code=204)
def delete_challenge(
    challenge_id: int, owner: Owner = Depends(require_account)
) -> Response:
    conn = get_connection()
    with _lock:
        _owned_challenge(conn, challenge_id, owner)
        conn.execute("DELETE FROM challenges WHERE id = ?", (challenge_id,))
        conn.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Users (jugadores) — por dueño
# ---------------------------------------------------------------------------

@app.get("/api/users", response_model=list[User])
def list_users(owner: Owner = Depends(require_owner)) -> list[User]:
    conn = get_connection()
    with _lock:
        rows = conn.execute(
            "SELECT * FROM users WHERE owner_key = ? ORDER BY id ASC", (owner.key,)
        ).fetchall()
    return [User(**user_row_to_dict(r)) for r in rows]


@app.post("/api/users", response_model=User, status_code=201)
def create_user(payload: UserCreate, owner: Owner = Depends(require_owner)) -> User:
    conn = get_connection()
    with _lock:
        color = payload.color
        if not color:
            count = conn.execute(
                "SELECT COUNT(*) AS c FROM users WHERE owner_key = ?", (owner.key,)
            ).fetchone()["c"]
            color = COLOR_PALETTE[count % len(COLOR_PALETTE)]
        cur = conn.execute(
            "INSERT INTO users (owner_key, name, color) VALUES (?, ?, ?)",
            (owner.key, payload.name, color),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM users WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
    return User(**user_row_to_dict(row))


@app.delete("/api/users/{user_id}", status_code=204)
def delete_user(user_id: int, owner: Owner = Depends(require_owner)) -> Response:
    conn = get_connection()
    with _lock:
        cur = conn.execute(
            "DELETE FROM users WHERE id = ? AND owner_key = ?", (user_id, owner.key)
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Word groups — presets públicos + los del dueño
# ---------------------------------------------------------------------------

def _owned_word_group(
    conn: sqlite3.Connection, group_id: int, owner: Owner
) -> sqlite3.Row:
    row = conn.execute(
        "SELECT * FROM word_groups WHERE id = ? AND owner_key = ?",
        (group_id, owner.key),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Grupo no encontrado.")
    return row


@app.get("/api/word-groups", response_model=list[WordGroup])
def list_word_groups(owner: Owner | None = Depends(resolve_owner)) -> list[WordGroup]:
    conn = get_connection()
    with _lock:
        rows = conn.execute(
            "SELECT * FROM word_groups WHERE owner_key IS NULL OR owner_key = ? "
            "ORDER BY owner_key IS NOT NULL, id ASC",
            (owner.key if owner else "",),
        ).fetchall()
    return [WordGroup(**word_group_row_to_dict(r)) for r in rows]


@app.post("/api/word-groups", response_model=WordGroup, status_code=201)
def create_word_group(
    payload: WordGroupCreate, owner: Owner = Depends(require_owner)
) -> WordGroup:
    conn = get_connection()
    with _lock:
        cur = conn.execute(
            "INSERT INTO word_groups (owner_key, name, words, created_at) VALUES (?, ?, ?, ?)",
            (owner.key, payload.name, json.dumps(payload.words, ensure_ascii=False), _now()),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM word_groups WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
    return WordGroup(**word_group_row_to_dict(row))


@app.post("/api/word-groups/import", response_model=ImportResult)
def import_word_groups(
    payload: ImportGroupsRequest, owner: Owner = Depends(require_owner)
) -> ImportResult:
    """Importa grupos desde un fichero exportado, evitando duplicados.

    Un grupo se considera duplicado si su nombre (normalizado: sin espacios al
    borde y sin distinguir mayúsculas) ya existe entre los del dueño o se repite
    dentro del propio fichero; en ese caso se omite.
    """
    conn = get_connection()
    now = _now()
    imported = 0
    skipped = 0
    with _lock:
        seen = {
            r["name"].strip().lower()
            for r in conn.execute(
                "SELECT name FROM word_groups WHERE owner_key = ?", (owner.key,)
            ).fetchall()
        }
        for g in payload.groups:
            key = g.name.strip().lower()
            if key in seen:
                skipped += 1
                continue
            conn.execute(
                "INSERT INTO word_groups (owner_key, name, words, created_at) VALUES (?, ?, ?, ?)",
                (owner.key, g.name, json.dumps(g.words, ensure_ascii=False), now),
            )
            seen.add(key)
            imported += 1
        conn.commit()
    return ImportResult(imported=imported, skipped=skipped)


@app.put("/api/word-groups/{group_id}", response_model=WordGroup)
def update_word_group(
    group_id: int, payload: WordGroupUpdate, owner: Owner = Depends(require_owner)
) -> WordGroup:
    conn = get_connection()
    with _lock:
        row = _owned_word_group(conn, group_id, owner)

        fields: list[str] = []
        values: list = []
        if payload.name is not None:
            fields.append("name = ?")
            values.append(payload.name)
        if payload.words is not None:
            fields.append("words = ?")
            values.append(json.dumps(payload.words, ensure_ascii=False))

        if fields:
            values.append(group_id)
            conn.execute(
                f"UPDATE word_groups SET {', '.join(fields)} WHERE id = ?",
                values,
            )
            conn.commit()

        row = conn.execute(
            "SELECT * FROM word_groups WHERE id = ?", (group_id,)
        ).fetchone()
    return WordGroup(**word_group_row_to_dict(row))


@app.delete("/api/word-groups/{group_id}", status_code=204)
def delete_word_group(group_id: int, owner: Owner = Depends(require_owner)) -> Response:
    conn = get_connection()
    with _lock:
        _owned_word_group(conn, group_id, owner)
        conn.execute("DELETE FROM word_groups WHERE id = ?", (group_id,))
        conn.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Draw — critical logic per CONTRACT.md (state scoped per owner)
# ---------------------------------------------------------------------------

@app.post("/api/draw", response_model=DrawResult)
def draw(payload: DrawRequest, owner: Owner = Depends(require_owner)) -> DrawResult:
    conn = get_connection()
    with _lock:
        total_users = conn.execute(
            "SELECT COUNT(*) AS c FROM users WHERE owner_key = ?", (owner.key,)
        ).fetchone()["c"]

        # ----- Determine the pool of considered users -----
        if total_users == 0:
            # Case 1: no users registered at all. Ignore required_users; assign none.
            pool: list[dict] = []
        else:
            if payload.mode == "random":
                rows = conn.execute(
                    "SELECT * FROM users WHERE owner_key = ? ORDER BY id ASC",
                    (owner.key,),
                ).fetchall()
                pool = [user_row_to_dict(r) for r in rows]
            else:  # mode == "selected"
                ids = payload.selected_user_ids or []
                if not ids:
                    raise HTTPException(
                        status_code=400,
                        detail="Selecciona al menos un usuario.",
                    )
                placeholders = ",".join("?" for _ in ids)
                rows = conn.execute(
                    f"SELECT * FROM users WHERE owner_key = ? AND id IN ({placeholders}) "
                    "ORDER BY id ASC",
                    [owner.key, *ids],
                ).fetchall()
                pool = [user_row_to_dict(r) for r in rows]
                if not pool:
                    raise HTTPException(
                        status_code=400,
                        detail="Selecciona al menos un usuario.",
                    )

        # ----- Compute eligible challenges -----
        # Una carta es elegible si no se ha usado o es repetible (puede salir
        # varias veces en la sesión). El umbral de personas requeridas es el
        # nº de involucradas si está definido, si no el nº que la realizan.
        # Si se indica collection_id, solo se consideran retos de esa colección;
        # si no, todas las visibles para el dueño.
        if payload.collection_id is not None:
            _visible_collection(conn, payload.collection_id, owner)
            coll_clause = " AND c.collection_id = ?"
            coll_params: list = [payload.collection_id]
        else:
            clause, coll_params = _visible_collection_filter(owner)
            coll_clause = f" AND c.collection_id IN (SELECT id FROM collections WHERE {clause})"

        users_clause = ""
        users_params: list = []
        if total_users > 0:
            # Case 2: además COALESCE(involved_users, required_users) <= len(pool).
            users_clause = " AND COALESCE(c.involved_users, c.required_users) <= ?"
            users_params = [len(pool)]

        eligible_rows = conn.execute(
            _CHALLENGE_WITH_STATE
            + "WHERE (COALESCE(ds.draw_count, 0) = 0 OR c.repeatable = 1)"
            + users_clause
            + coll_clause,
            [owner.key, *users_params, *coll_params],
        ).fetchall()

        if not eligible_rows:
            raise HTTPException(
                status_code=409,
                detail="No quedan retos disponibles. Reinicia la sesión.",
            )

        # ----- Pick a random challenge (ponderado por veces ya sorteada) -----
        # Las cartas que ya han salido pesan menos, de forma que las repetibles
        # sin sacar (o menos sacadas) tienen mucha más probabilidad de salir.
        # Restamos el draw_count mínimo del bote: la carta menos sacada siempre
        # pesa 1.0 y el resto decae. Los pesos relativos son idénticos, pero así
        # los exponentes no crecen sin límite en sesiones muy largas (evita el
        # underflow a 0.0 que haría fallar a random.choices por "suma de pesos =
        # 0"). Con REPEAT_DECAY=0 esto da rotación pura sin romperse.
        min_drawn = min(row["draw_count"] for row in eligible_rows)
        weights = [
            REPEAT_DECAY ** (row["draw_count"] - min_drawn) for row in eligible_rows
        ]
        chosen_row = random.choices(eligible_rows, weights=weights, k=1)[0]

        # ----- Assign users (random, no repeats within this draw) -----
        # Solo se asignan usuarios con nombre a quienes REALIZAN el reto; el
        # resto de involucrados queda como participantes anónimos.
        assigned: list[dict] = []
        anonymous_count = 0
        if total_users > 0 and chosen_row["required_users"] > 0:
            assigned = random.sample(pool, chosen_row["required_users"])
            if chosen_row["involved_users"] is not None:
                anonymous_count = max(
                    0, chosen_row["involved_users"] - chosen_row["required_users"]
                )

        # ----- Record the draw for this owner -----
        # Siempre se incrementa draw_count para ir bajando la probabilidad de
        # que vuelva a salir; en las no repetibles eso las marca como usadas.
        conn.execute(
            "INSERT INTO draw_state (owner_key, challenge_id, draw_count) VALUES (?, ?, 1) "
            "ON CONFLICT(owner_key, challenge_id) DO UPDATE SET draw_count = draw_count + 1",
            (owner.key, chosen_row["id"]),
        )
        conn.commit()
        chosen_row = conn.execute(
            _CHALLENGE_WITH_STATE + "WHERE c.id = ?", (owner.key, chosen_row["id"])
        ).fetchone()

        # ----- Remaining = cartas que aún NO han salido esta sesión (draw_count
        # == 0), con el mismo filtro de colección que el sorteo. Es el indicador
        # de progreso del contador: baja hasta 0 cuando han salido todas. No
        # bloquea el sorteo: las repetibles siguen siendo elegibles aunque sea 0.
        remaining = conn.execute(
            "SELECT COUNT(*) AS c FROM challenges c "
            "LEFT JOIN draw_state ds ON ds.challenge_id = c.id AND ds.owner_key = ? "
            "WHERE COALESCE(ds.draw_count, 0) = 0" + coll_clause,
            [owner.key, *coll_params],
        ).fetchone()["c"]

    return DrawResult(
        challenge=Challenge(**challenge_row_to_dict(chosen_row)),
        assigned_users=[User(**u) for u in assigned],
        anonymous_count=anonymous_count,
        remaining=remaining,
    )


# ---------------------------------------------------------------------------
# Reset & Stats (per owner)
# ---------------------------------------------------------------------------

@app.post("/api/reset", response_model=ResetResult)
def reset(
    collection_id: int | None = Query(default=None),
    owner: Owner = Depends(require_owner),
) -> ResetResult:
    conn = get_connection()
    with _lock:
        if collection_id is not None:
            _visible_collection(conn, collection_id, owner)
            cur = conn.execute(
                "DELETE FROM draw_state WHERE owner_key = ? AND challenge_id IN "
                "(SELECT id FROM challenges WHERE collection_id = ?)",
                (owner.key, collection_id),
            )
        else:
            cur = conn.execute(
                "DELETE FROM draw_state WHERE owner_key = ?", (owner.key,)
            )
        conn.commit()
        count = cur.rowcount
    return ResetResult(reset=count)


@app.get("/api/stats", response_model=Stats)
def stats(
    collection_id: int | None = Query(default=None),
    owner: Owner = Depends(require_owner),
) -> Stats:
    conn = get_connection()
    with _lock:
        if collection_id is not None:
            _visible_collection(conn, collection_id, owner)
            coll_clause = " WHERE c.collection_id = ?"
            coll_params: list = [collection_id]
        else:
            clause, coll_params = _visible_collection_filter(owner)
            coll_clause = f" WHERE c.collection_id IN (SELECT id FROM collections WHERE {clause})"
        total = conn.execute(
            "SELECT COUNT(*) AS c FROM challenges c" + coll_clause, coll_params
        ).fetchone()["c"]
        used = conn.execute(
            "SELECT COUNT(*) AS c FROM challenges c "
            "JOIN draw_state ds ON ds.challenge_id = c.id AND ds.owner_key = ? AND ds.draw_count > 0"
            + coll_clause,
            [owner.key, *coll_params],
        ).fetchone()["c"]
        users = conn.execute(
            "SELECT COUNT(*) AS c FROM users WHERE owner_key = ?", (owner.key,)
        ).fetchone()["c"]
    # "used" = cartas que YA han salido (draw_count>0), incluidas las repetibles;
    # "available" = las que aún no han salido. Así el contador refleja progreso y
    # llega a 0 cuando han salido todas (el sorteo sigue permitido: las repetibles
    # siguen siendo elegibles aunque available sea 0).
    return Stats(total=total, used=used, available=total - used, users=users)
