"""RetoBox API — FastAPI application.

Implements the REST contract defined in CONTRACT.md (all routes under /api).
Persistence is SQLite via the standard-library driver; see app/database.py.
"""

import os
import random
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from app.database import (
    _lock,
    challenge_row_to_dict,
    get_connection,
    init_db,
    user_row_to_dict,
)
from app.models import (
    Challenge,
    ChallengeCreate,
    ChallengeUpdate,
    DrawRequest,
    DrawResult,
    Health,
    ResetResult,
    Stats,
    User,
    UserCreate,
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
# Challenges
# ---------------------------------------------------------------------------

@app.get("/api/challenges", response_model=list[Challenge])
def list_challenges() -> list[Challenge]:
    conn = get_connection()
    with _lock:
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
        cur = conn.execute(
            "INSERT INTO challenges (title, description, required_users, is_used, created_at) "
            "VALUES (?, ?, ?, 0, ?)",
            (payload.title, payload.description, payload.required_users, now),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM challenges WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
    return Challenge(**challenge_row_to_dict(row))


@app.put("/api/challenges/{challenge_id}", response_model=Challenge)
def update_challenge(challenge_id: int, payload: ChallengeUpdate) -> Challenge:
    conn = get_connection()
    with _lock:
        row = conn.execute(
            "SELECT * FROM challenges WHERE id = ?", (challenge_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Reto no encontrado.")

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
        if total_users == 0:
            # Case 1: ignore required_users.
            eligible_rows = conn.execute(
                "SELECT * FROM challenges WHERE is_used = 0"
            ).fetchall()
        else:
            # Case 2: also require required_users <= len(pool).
            eligible_rows = conn.execute(
                "SELECT * FROM challenges WHERE is_used = 0 AND required_users <= ?",
                (len(pool),),
            ).fetchall()

        if not eligible_rows:
            raise HTTPException(
                status_code=409,
                detail="No quedan retos disponibles. Reinicia la sesión.",
            )

        # ----- Pick a random challenge -----
        chosen_row = random.choice(eligible_rows)
        chosen = challenge_row_to_dict(chosen_row)

        # ----- Assign users (random, no repeats within this draw) -----
        assigned: list[dict] = []
        if total_users > 0 and chosen["required_users"] > 0:
            assigned = random.sample(pool, chosen["required_users"])

        # ----- Mark chosen challenge as used -----
        conn.execute(
            "UPDATE challenges SET is_used = 1 WHERE id = ?", (chosen["id"],)
        )
        conn.commit()
        chosen["is_used"] = True

        # ----- Remaining = eligible cards left with the SAME pool after this one -----
        remaining = len(eligible_rows) - 1

    return DrawResult(
        challenge=Challenge(**chosen),
        assigned_users=[User(**u) for u in assigned],
        remaining=remaining,
    )


# ---------------------------------------------------------------------------
# Reset & Stats
# ---------------------------------------------------------------------------

@app.post("/api/reset", response_model=ResetResult)
def reset() -> ResetResult:
    conn = get_connection()
    with _lock:
        cur = conn.execute(
            "UPDATE challenges SET is_used = 0 WHERE is_used = 1"
        )
        conn.commit()
        count = cur.rowcount
    return ResetResult(reset=count)


@app.get("/api/stats", response_model=Stats)
def stats() -> Stats:
    conn = get_connection()
    with _lock:
        total = conn.execute(
            "SELECT COUNT(*) AS c FROM challenges"
        ).fetchone()["c"]
        used = conn.execute(
            "SELECT COUNT(*) AS c FROM challenges WHERE is_used = 1"
        ).fetchone()["c"]
        users = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
    return Stats(total=total, used=used, available=total - used, users=users)
