"""Pytest fixtures for the RetoBox API.

A temporary SQLite file is configured BEFORE importing the app (DATABASE_PATH is
read at import time), seeding is disabled, and every test starts from empty
tables so tests are order-independent.
"""

import os
import tempfile

# Must be set before importing app.database / app.main.
_TMP_DIR = tempfile.mkdtemp(prefix="retobox-tests-")
os.environ["DATABASE_PATH"] = os.path.join(_TMP_DIR, "test.db")
os.environ.pop("SEED_DATA", None)  # prod-like default: no auto seed

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import _lock, get_connection, init_db  # noqa: E402
from app.main import app  # noqa: E402

init_db()


@pytest.fixture(autouse=True)
def _clean_db():
    """Empty all tables and reset autoincrement before each test."""
    conn = get_connection()
    with _lock:
        conn.execute("DELETE FROM challenges")
        conn.execute("DELETE FROM users")
        conn.execute("DELETE FROM word_groups")
        conn.execute("DELETE FROM collections")
        try:
            conn.execute("DELETE FROM sqlite_sequence")
        except Exception:
            pass  # table only exists after first AUTOINCREMENT insert
        conn.commit()
    yield


@pytest.fixture
def client():
    return TestClient(app)


# --- helpers -------------------------------------------------------------

def make_challenge(
    client,
    title="Reto de prueba",
    description="",
    required_users=1,
    involved_users=None,
    repeatable=False,
    collection_id=None,
):
    body = {
        "title": title,
        "description": description,
        "required_users": required_users,
        "repeatable": repeatable,
    }
    if involved_users is not None:
        body["involved_users"] = involved_users
    if collection_id is not None:
        body["collection_id"] = collection_id
    r = client.post("/api/challenges", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def make_collection(client, name="Colección"):
    r = client.post("/api/collections", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()


def make_user(client, name, color=None):
    body = {"name": name}
    if color is not None:
        body["color"] = color
    r = client.post("/api/users", json=body)
    assert r.status_code == 201, r.text
    return r.json()
