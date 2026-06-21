"""SQLite persistence layer for RetoBox.

Uses the Python standard-library ``sqlite3`` driver directly to keep the
dependency surface minimal. A single connection is shared across the app with
``check_same_thread=False``; FastAPI's default threadpool serializes through a
module-level lock to keep writes consistent on SQLite.
"""

import json
import os
import sqlite3
import threading

# Database location is configurable via env var (default matches the contract).
DATABASE_PATH = os.environ.get("DATABASE_PATH", "/data/retobox.db")

# A coarse lock guarding all DB access. SQLite handles modest concurrency
# poorly under threads; serializing is simple, correct, and more than fast
# enough for this workload.
_lock = threading.Lock()
_connection: sqlite3.Connection | None = None


def _ensure_parent_dir(path: str) -> None:
    parent = os.path.dirname(path)
    if parent and not os.path.exists(parent):
        os.makedirs(parent, exist_ok=True)


def get_connection() -> sqlite3.Connection:
    """Return the shared SQLite connection, creating it on first use."""
    global _connection
    if _connection is None:
        _ensure_parent_dir(DATABASE_PATH)
        _connection = sqlite3.connect(DATABASE_PATH, check_same_thread=False)
        _connection.row_factory = sqlite3.Row
        _connection.execute("PRAGMA journal_mode=WAL;")
        _connection.execute("PRAGMA foreign_keys=ON;")
    return _connection


def init_db() -> None:
    """Create tables if they do not exist and run lightweight migrations.

    Migrations are additive ``ALTER TABLE ADD COLUMN`` statements guarded by a
    column-existence check, so they are idempotent and never drop or rewrite
    existing rows. This is safe to run on every startup against a live DB.
    """
    conn = get_connection()
    with _lock:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS challenges (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                title          TEXT    NOT NULL,
                description    TEXT    NOT NULL DEFAULT '',
                required_users INTEGER NOT NULL DEFAULT 1,
                involved_users INTEGER,
                repeatable     INTEGER NOT NULL DEFAULT 0,
                is_used        INTEGER NOT NULL DEFAULT 0,
                draw_count     INTEGER NOT NULL DEFAULT 0,
                created_at     TEXT    NOT NULL,
                collection_id  INTEGER
            );

            -- Colecciones que agrupan retos (p. ej. para distintas situaciones).
            CREATE TABLE IF NOT EXISTS collections (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT    NOT NULL,
                created_at TEXT    NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
                id    INTEGER PRIMARY KEY AUTOINCREMENT,
                name  TEXT NOT NULL,
                color TEXT NOT NULL
            );

            -- Grupos de palabras del juego de combinaciones (mezclador). Las
            -- palabras se guardan como un array JSON en una sola columna TEXT.
            CREATE TABLE IF NOT EXISTS word_groups (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT    NOT NULL,
                words      TEXT    NOT NULL DEFAULT '[]',
                created_at TEXT    NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_challenges_is_used
                ON challenges(is_used);
            """
        )

        # --- Additive migrations for databases created before these columns ---
        existing = {
            r["name"]
            for r in conn.execute("PRAGMA table_info(challenges)").fetchall()
        }
        if "involved_users" not in existing:
            # Nullable: cuando está vacío solo cuenta required_users.
            conn.execute(
                "ALTER TABLE challenges ADD COLUMN involved_users INTEGER"
            )
        if "repeatable" not in existing:
            conn.execute(
                "ALTER TABLE challenges ADD COLUMN repeatable INTEGER NOT NULL DEFAULT 0"
            )
        if "collection_id" not in existing:
            conn.execute(
                "ALTER TABLE challenges ADD COLUMN collection_id INTEGER"
            )
        if "draw_count" not in existing:
            # Veces que se ha sorteado la carta en la sesión. Se usa para
            # reducir la probabilidad de que una repetible vuelva a salir.
            conn.execute(
                "ALTER TABLE challenges ADD COLUMN draw_count INTEGER NOT NULL DEFAULT 0"
            )

        # El índice sobre collection_id va aquí (tras garantizar la columna en
        # tablas previas; en el CREATE de arriba la tabla podía ya existir sin ella).
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_challenges_collection "
            "ON challenges(collection_id)"
        )

        # Siempre debe existir al menos una colección. Los retos sin colección
        # (BD previas) se asignan a la colección por defecto "General".
        default_id = _get_or_create_default_collection(conn)
        conn.execute(
            "UPDATE challenges SET collection_id = ? WHERE collection_id IS NULL",
            (default_id,),
        )

        conn.commit()


DEFAULT_COLLECTION_NAME = "General"


def _get_or_create_default_collection(conn: sqlite3.Connection) -> int:
    """Devuelve el id de la colección por defecto (la primera). La crea si no hay."""
    row = conn.execute(
        "SELECT id FROM collections ORDER BY id ASC LIMIT 1"
    ).fetchone()
    if row is not None:
        return row["id"]
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    cur = conn.execute(
        "INSERT INTO collections (name, created_at) VALUES (?, ?)",
        (DEFAULT_COLLECTION_NAME, now),
    )
    return cur.lastrowid


def get_default_collection_id() -> int:
    """Id de la colección por defecto, para asignar retos sin colección explícita."""
    conn = get_connection()
    return _get_or_create_default_collection(conn)


# ---------------------------------------------------------------------------
# Row -> dict helpers (normalize SQLite's integer booleans)
# ---------------------------------------------------------------------------

def challenge_row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "required_users": row["required_users"],
        "involved_users": row["involved_users"],
        "repeatable": bool(row["repeatable"]),
        "is_used": bool(row["is_used"]),
        "created_at": row["created_at"],
        "collection_id": row["collection_id"],
    }


def collection_row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "created_at": row["created_at"],
    }


def user_row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "color": row["color"],
    }


def word_group_row_to_dict(row: sqlite3.Row) -> dict:
    try:
        words = json.loads(row["words"]) if row["words"] else []
    except (ValueError, TypeError):
        words = []
    return {
        "id": row["id"],
        "name": row["name"],
        "words": [w for w in words if isinstance(w, str)],
        "created_at": row["created_at"],
    }
