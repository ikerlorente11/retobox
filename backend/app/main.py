"""RetoBox API — FastAPI application.

Implements the REST contract defined in CONTRACT.md (all routes under /api).
Persistence is SQLite via the standard-library driver; see app/database.py.
"""

import json
import os
import random
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware

from app.database import (
    _lock,
    challenge_row_to_dict,
    collection_row_to_dict,
    get_connection,
    get_default_collection_id,
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
from app.seed import seed_if_empty

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

# Solo se cargan los retos de ejemplo si SEED_DATA está activado (1/true/yes).
# En desarrollo -> activado (verás las tarjetas de prueba).
# En producción -> desactivado (arranca vacío; solo lo que metáis después).
SEED_DATA = os.environ.get("SEED_DATA", "").lower() in ("1", "true", "yes", "on")

# Factor de decaimiento de probabilidad para cartas repetibles. El peso de una
# carta en el sorteo es REPEAT_DECAY ** (veces ya sacada). Con 0.1, una carta
# vista una vez es 10x menos probable que una sin ver, vista dos veces 100x
# menos, etc. Así las repetibles que aún no han salido se priorizan con fuerza y
# prácticamente no se repite ninguna hasta que van saliendo las demás (verificado
# por simulación: reparto casi uniforme y orden aleatorio). Configurable por env
# var: 1.0 = uniforme (sin anti-repetición); 0.0 = rotación pura (no repite hasta
# agotar todas). Valores bajos (0.05–0.1) = muy anti-repetición pero aleatorio.
REPEAT_DECAY = float(os.environ.get("REPEAT_DECAY", "0.1"))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Initialize schema; seed example data only when SEED_DATA is enabled.
    init_db()
    if SEED_DATA:
        seed_if_empty()
    yield


app = FastAPI(title="RetoBox API", version="1.0.0", lifespan=lifespan)

# CORS wide open per the contract.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/api/health", response_model=Health)
def health() -> Health:
    return Health(status="ok")


# ---------------------------------------------------------------------------
# Collections — agrupan retos (cada reto pertenece a una colección)
# ---------------------------------------------------------------------------

@app.get("/api/collections", response_model=list[Collection])
def list_collections() -> list[Collection]:
    conn = get_connection()
    with _lock:
        rows = conn.execute(
            "SELECT * FROM collections ORDER BY id ASC"
        ).fetchall()
    return [Collection(**collection_row_to_dict(r)) for r in rows]


@app.post("/api/collections", response_model=Collection, status_code=201)
def create_collection(payload: CollectionCreate) -> Collection:
    conn = get_connection()
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    with _lock:
        cur = conn.execute(
            "INSERT INTO collections (name, created_at) VALUES (?, ?)",
            (payload.name, now),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM collections WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
    return Collection(**collection_row_to_dict(row))


@app.put("/api/collections/{collection_id}", response_model=Collection)
def update_collection(collection_id: int, payload: CollectionUpdate) -> Collection:
    conn = get_connection()
    with _lock:
        row = conn.execute(
            "SELECT * FROM collections WHERE id = ?", (collection_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Colección no encontrada.")
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
def delete_collection(collection_id: int) -> Response:
    conn = get_connection()
    with _lock:
        row = conn.execute(
            "SELECT 1 FROM collections WHERE id = ?", (collection_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Colección no encontrada.")
        count = conn.execute(
            "SELECT COUNT(*) AS c FROM collections"
        ).fetchone()["c"]
        if count <= 1:
            raise HTTPException(
                status_code=409,
                detail="No puedes borrar la única colección.",
            )
        # Borra la colección y los retos que contiene.
        conn.execute(
            "DELETE FROM challenges WHERE collection_id = ?", (collection_id,)
        )
        conn.execute("DELETE FROM collections WHERE id = ?", (collection_id,))
        conn.commit()
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Challenges
# ---------------------------------------------------------------------------

@app.get("/api/challenges", response_model=list[Challenge])
def list_challenges(collection_id: int | None = Query(default=None)) -> list[Challenge]:
    conn = get_connection()
    with _lock:
        if collection_id is not None:
            rows = conn.execute(
                "SELECT * FROM challenges WHERE collection_id = ? ORDER BY id ASC",
                (collection_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM challenges ORDER BY id ASC"
            ).fetchall()
    return [Challenge(**challenge_row_to_dict(r)) for r in rows]


@app.post("/api/challenges", response_model=Challenge, status_code=201)
def create_challenge(payload: ChallengeCreate) -> Challenge:
    conn = get_connection()
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    with _lock:
        collection_id = payload.collection_id
        if collection_id is None:
            collection_id = get_default_collection_id()
        elif (
            conn.execute(
                "SELECT 1 FROM collections WHERE id = ?", (collection_id,)
            ).fetchone()
            is None
        ):
            raise HTTPException(status_code=404, detail="Colección no encontrada.")
        cur = conn.execute(
            "INSERT INTO challenges "
            "(title, description, required_users, involved_users, repeatable, is_used, created_at, collection_id) "
            "VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
            (
                payload.title,
                payload.description,
                payload.required_users,
                payload.involved_users,
                int(payload.repeatable),
                now,
                collection_id,
            ),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM challenges WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
    return Challenge(**challenge_row_to_dict(row))


@app.post("/api/challenges/import", response_model=ImportResult)
def import_challenges(payload: ImportRequest) -> ImportResult:
    """Importa retos a una colección, evitando duplicados.

    Un reto se considera duplicado si su título (normalizado: sin espacios al
    borde y sin distinguir mayúsculas) ya existe EN ESA COLECCIÓN; en ese caso se
    omite. También se descartan duplicados dentro del propio fichero.
    """
    conn = get_connection()
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    imported = 0
    skipped = 0
    with _lock:
        collection_id = payload.collection_id
        if collection_id is None:
            collection_id = get_default_collection_id()
        elif (
            conn.execute(
                "SELECT 1 FROM collections WHERE id = ?", (collection_id,)
            ).fetchone()
            is None
        ):
            raise HTTPException(status_code=404, detail="Colección no encontrada.")

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
            conn.execute(
                "INSERT INTO challenges "
                "(title, description, required_users, involved_users, repeatable, is_used, created_at, collection_id) "
                "VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
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
            seen.add(key)
            imported += 1
        conn.commit()
    return ImportResult(imported=imported, skipped=skipped)


@app.put("/api/challenges/{challenge_id}", response_model=Challenge)
def update_challenge(challenge_id: int, payload: ChallengeUpdate) -> Challenge:
    conn = get_connection()
    with _lock:
        row = conn.execute(
            "SELECT * FROM challenges WHERE id = ?", (challenge_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Reto no encontrado.")

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
            "SELECT * FROM challenges WHERE id = ?", (challenge_id,)
        ).fetchone()
    return Challenge(**challenge_row_to_dict(row))


@app.delete("/api/challenges/{challenge_id}", status_code=204)
def delete_challenge(challenge_id: int) -> Response:
    conn = get_connection()
    with _lock:
        cur = conn.execute(
            "DELETE FROM challenges WHERE id = ?", (challenge_id,)
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Reto no encontrado.")
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@app.get("/api/users", response_model=list[User])
def list_users() -> list[User]:
    conn = get_connection()
    with _lock:
        rows = conn.execute("SELECT * FROM users ORDER BY id ASC").fetchall()
    return [User(**user_row_to_dict(r)) for r in rows]


@app.post("/api/users", response_model=User, status_code=201)
def create_user(payload: UserCreate) -> User:
    conn = get_connection()
    with _lock:
        color = payload.color
        if not color:
            count = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
            color = COLOR_PALETTE[count % len(COLOR_PALETTE)]
        cur = conn.execute(
            "INSERT INTO users (name, color) VALUES (?, ?)",
            (payload.name, color),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM users WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
    return User(**user_row_to_dict(row))


@app.delete("/api/users/{user_id}", status_code=204)
def delete_user(user_id: int) -> Response:
    conn = get_connection()
    with _lock:
        cur = conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Word groups — juego de combinaciones (mezclador)
# ---------------------------------------------------------------------------

@app.get("/api/word-groups", response_model=list[WordGroup])
def list_word_groups() -> list[WordGroup]:
    conn = get_connection()
    with _lock:
        rows = conn.execute(
            "SELECT * FROM word_groups ORDER BY id ASC"
        ).fetchall()
    return [WordGroup(**word_group_row_to_dict(r)) for r in rows]


@app.post("/api/word-groups", response_model=WordGroup, status_code=201)
def create_word_group(payload: WordGroupCreate) -> WordGroup:
    conn = get_connection()
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    with _lock:
        cur = conn.execute(
            "INSERT INTO word_groups (name, words, created_at) VALUES (?, ?, ?)",
            (payload.name, json.dumps(payload.words, ensure_ascii=False), now),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM word_groups WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
    return WordGroup(**word_group_row_to_dict(row))


@app.post("/api/word-groups/import", response_model=ImportResult)
def import_word_groups(payload: ImportGroupsRequest) -> ImportResult:
    """Importa grupos desde un fichero exportado, evitando duplicados.

    Un grupo se considera duplicado si su nombre (normalizado: sin espacios al
    borde y sin distinguir mayúsculas) ya existe en la BD o se repite dentro del
    propio fichero; en ese caso se omite.
    """
    conn = get_connection()
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    imported = 0
    skipped = 0
    with _lock:
        seen = {
            r["name"].strip().lower()
            for r in conn.execute("SELECT name FROM word_groups").fetchall()
        }
        for g in payload.groups:
            key = g.name.strip().lower()
            if key in seen:
                skipped += 1
                continue
            conn.execute(
                "INSERT INTO word_groups (name, words, created_at) VALUES (?, ?, ?)",
                (g.name, json.dumps(g.words, ensure_ascii=False), now),
            )
            seen.add(key)
            imported += 1
        conn.commit()
    return ImportResult(imported=imported, skipped=skipped)


@app.put("/api/word-groups/{group_id}", response_model=WordGroup)
def update_word_group(group_id: int, payload: WordGroupUpdate) -> WordGroup:
    conn = get_connection()
    with _lock:
        row = conn.execute(
            "SELECT * FROM word_groups WHERE id = ?", (group_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Grupo no encontrado.")

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
def delete_word_group(group_id: int) -> Response:
    conn = get_connection()
    with _lock:
        cur = conn.execute(
            "DELETE FROM word_groups WHERE id = ?", (group_id,)
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Grupo no encontrado.")
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Draw — critical logic per CONTRACT.md
# ---------------------------------------------------------------------------

@app.post("/api/draw", response_model=DrawResult)
def draw(payload: DrawRequest) -> DrawResult:
    conn = get_connection()
    with _lock:
        total_users = conn.execute(
            "SELECT COUNT(*) AS c FROM users"
        ).fetchone()["c"]

        # ----- Determine the pool of considered users -----
        if total_users == 0:
            # Case 1: no users registered at all. Ignore required_users; assign none.
            pool: list[dict] = []
        else:
            if payload.mode == "random":
                rows = conn.execute(
                    "SELECT * FROM users ORDER BY id ASC"
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
                    f"SELECT * FROM users WHERE id IN ({placeholders}) ORDER BY id ASC",
                    ids,
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
        # Si se indica collection_id, solo se consideran retos de esa colección.
        coll_clause = ""
        coll_params: list = []
        if payload.collection_id is not None:
            coll_clause = " AND collection_id = ?"
            coll_params = [payload.collection_id]

        if total_users == 0:
            # Case 1: no hay usuarios -> se ignora el requisito de personas.
            eligible_rows = conn.execute(
                "SELECT * FROM challenges WHERE (is_used = 0 OR repeatable = 1)"
                + coll_clause,
                coll_params,
            ).fetchall()
        else:
            # Case 2: además COALESCE(involved_users, required_users) <= len(pool).
            eligible_rows = conn.execute(
                "SELECT * FROM challenges "
                "WHERE (is_used = 0 OR repeatable = 1) "
                "AND COALESCE(involved_users, required_users) <= ?" + coll_clause,
                [len(pool), *coll_params],
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
        chosen = challenge_row_to_dict(chosen_row)

        # ----- Assign users (random, no repeats within this draw) -----
        # Solo se asignan usuarios con nombre a quienes REALIZAN el reto; el
        # resto de involucrados queda como participantes anónimos.
        assigned: list[dict] = []
        anonymous_count = 0
        if total_users > 0 and chosen["required_users"] > 0:
            assigned = random.sample(pool, chosen["required_users"])
            if chosen["involved_users"] is not None:
                anonymous_count = max(
                    0, chosen["involved_users"] - chosen["required_users"]
                )

        # ----- Mark chosen challenge as used (las repetibles no se marcan) -----
        # Siempre se incrementa draw_count para ir bajando la probabilidad de
        # que vuelva a salir; las no repetibles además se marcan como usadas.
        if not chosen["repeatable"]:
            conn.execute(
                "UPDATE challenges SET is_used = 1, draw_count = draw_count + 1 "
                "WHERE id = ?",
                (chosen["id"],),
            )
            chosen["is_used"] = True
        else:
            conn.execute(
                "UPDATE challenges SET draw_count = draw_count + 1 WHERE id = ?",
                (chosen["id"],),
            )
        conn.commit()

        # ----- Remaining = cartas que aún NO han salido esta sesión (draw_count
        # == 0), con el mismo filtro de colección que el sorteo. Es el indicador
        # de progreso del contador: baja hasta 0 cuando han salido todas. No
        # bloquea el sorteo: las repetibles siguen siendo elegibles aunque sea 0.
        remaining = conn.execute(
            "SELECT COUNT(*) AS c FROM challenges WHERE draw_count = 0" + coll_clause,
            coll_params,
        ).fetchone()["c"]

    return DrawResult(
        challenge=Challenge(**chosen),
        assigned_users=[User(**u) for u in assigned],
        anonymous_count=anonymous_count,
        remaining=remaining,
    )


# ---------------------------------------------------------------------------
# Reset & Stats
# ---------------------------------------------------------------------------

@app.post("/api/reset", response_model=ResetResult)
def reset(collection_id: int | None = Query(default=None)) -> ResetResult:
    conn = get_connection()
    with _lock:
        if collection_id is not None:
            cur = conn.execute(
                "UPDATE challenges SET is_used = 0, draw_count = 0 "
                "WHERE (is_used = 1 OR draw_count > 0) AND collection_id = ?",
                (collection_id,),
            )
        else:
            cur = conn.execute(
                "UPDATE challenges SET is_used = 0, draw_count = 0 "
                "WHERE is_used = 1 OR draw_count > 0"
            )
        conn.commit()
        count = cur.rowcount
    return ResetResult(reset=count)


@app.get("/api/stats", response_model=Stats)
def stats(collection_id: int | None = Query(default=None)) -> Stats:
    conn = get_connection()
    with _lock:
        if collection_id is not None:
            total = conn.execute(
                "SELECT COUNT(*) AS c FROM challenges WHERE collection_id = ?",
                (collection_id,),
            ).fetchone()["c"]
            used = conn.execute(
                "SELECT COUNT(*) AS c FROM challenges "
                "WHERE draw_count > 0 AND collection_id = ?",
                (collection_id,),
            ).fetchone()["c"]
        else:
            total = conn.execute(
                "SELECT COUNT(*) AS c FROM challenges"
            ).fetchone()["c"]
            used = conn.execute(
                "SELECT COUNT(*) AS c FROM challenges WHERE draw_count > 0"
            ).fetchone()["c"]
        users = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
    # "used" = cartas que YA han salido (draw_count>0), incluidas las repetibles;
    # "available" = las que aún no han salido. Así el contador refleja progreso y
    # llega a 0 cuando han salido todas (el sorteo sigue permitido: las repetibles
    # siguen siendo elegibles aunque available sea 0).
    return Stats(total=total, used=used, available=total - used, users=users)
