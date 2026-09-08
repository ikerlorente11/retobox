"""Pytest fixtures for the RetoBox API.

A temporary SQLite file is configured BEFORE importing the app (DATABASE_PATH is
read at import time) and every test starts from empty tables so tests are
order-independent. Presets are NOT seeded (tests that need them call
``seed_presets()`` explicitly).

``client`` is a logged-in account (with its auto-created first collection);
``guest`` is an anonymous visitor identified by an ``X-Guest-Key`` header.
"""

import os
import tempfile

# Must be set before importing app.database / app.main.
_TMP_DIR = tempfile.mkdtemp(prefix="retobox-tests-")
os.environ["DATABASE_PATH"] = os.path.join(_TMP_DIR, "test.db")
os.environ["BCRYPT_ROUNDS"] = "4"  # fast hashing in tests
os.environ.pop("GOOGLE_CLIENT_ID", None)

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
        for table in (
            "draw_state",
            "challenges",
            "users",
            "word_groups",
            "collections",
            "sessions",
            "accounts",
        ):
            conn.execute(f"DELETE FROM {table}")
        try:
            conn.execute("DELETE FROM sqlite_sequence")
        except Exception:
            pass  # table only exists after first AUTOINCREMENT insert
        conn.commit()
    yield


GUEST_KEY = "guest-test-key-0001"
ACCOUNT = {"email": "test@example.com", "password": "secret-pass-123", "name": "Tester"}


def register(client, **overrides):
    """Register (and log in) an account on this client. Returns the account."""
    body = {**ACCOUNT, **overrides}
    r = client.post("/api/auth/register", json=body)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def client():
    """A logged-in account with its auto-created first collection."""
    c = TestClient(app)
    register(c)
    return c


@pytest.fixture
def guest():
    """An anonymous visitor (guest identity via header, no session)."""
    return TestClient(app, headers={"X-Guest-Key": GUEST_KEY})


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
