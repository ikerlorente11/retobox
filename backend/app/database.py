"""SQLite persistence layer for RetoBox.

Uses the Python standard-library ``sqlite3`` driver directly to keep the
dependency surface minimal. A single connection is shared across the app with
``check_same_thread=False``; FastAPI's default threadpool serializes through a
module-level lock to keep writes consistent on SQLite.
"""

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
    """Create tables if they do not exist."""
    conn = get_connection()
    with _lock:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS challenges (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                title          TEXT    NOT NULL,
                description    TEXT    NOT NULL DEFAULT '',
                required_users INTEGER NOT NULL DEFAULT 1,
                is_used        INTEGER NOT NULL DEFAULT 0,
                created_at     TEXT    NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
                id    INTEGER PRIMARY KEY AUTOINCREMENT,
                name  TEXT NOT NULL,
                color TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_challenges_is_used
                ON challenges(is_used);
            """
        )
        conn.commit()


# ---------------------------------------------------------------------------
# Row -> dict helpers (normalize SQLite's integer booleans)
# ---------------------------------------------------------------------------

def challenge_row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "required_users": row["required_users"],
        "is_used": bool(row["is_used"]),
        "created_at": row["created_at"],
    }


def user_row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "color": row["color"],
    }
