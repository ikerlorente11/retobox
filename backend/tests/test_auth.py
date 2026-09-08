"""Accounts, sessions, guest identity, access control and per-owner isolation."""

from datetime import datetime, timedelta, timezone

from conftest import ACCOUNT, GUEST_KEY, make_challenge, make_collection, make_user, register
from fastapi.testclient import TestClient

from app import auth as auth_module
from app.main import app
from app.seed import seed_presets


def preset_collection(client):
    seed_presets()
    return next(c for c in client.get("/api/collections").json() if c["preset"])


# --------------------------------------------------------------------------
# Register / login / logout / me
# --------------------------------------------------------------------------

def test_register_sets_cookie_and_creates_first_collection(client):
    me = client.get("/api/auth/me").json()
    assert me["email"] == ACCOUNT["email"]
    assert me["name"] == "Tester"
    assert me["has_password"] and not me["has_google"]
    cols = client.get("/api/collections").json()
    assert len(cols) == 1 and not cols[0]["preset"] and cols[0]["owner_id"] == me["id"]


def test_register_duplicate_email_409():
    c = TestClient(app)
    register(c)
    r = c.post("/api/auth/register", json={**ACCOUNT, "email": " TEST@example.com "})
    assert r.status_code == 409


def test_register_validation_422():
    c = TestClient(app)
    assert c.post("/api/auth/register", json={"email": "nope", "password": "12345678"}).status_code == 422
    assert c.post("/api/auth/register", json={"email": "a@b.co", "password": "short"}).status_code == 422


def test_login_logout_flow():
    c = TestClient(app)
    register(c)
    c.cookies.clear()
    assert c.get("/api/auth/me").status_code == 401
    r = c.post("/api/auth/login", json={"email": ACCOUNT["email"], "password": ACCOUNT["password"]})
    assert r.status_code == 200
    assert c.get("/api/auth/me").status_code == 200
    assert c.post("/api/auth/logout").status_code == 204
    assert c.get("/api/auth/me").status_code == 401


def test_login_wrong_password_401_and_throttled():
    c = TestClient(app)
    register(c)
    c.cookies.clear()
    for _ in range(auth_module.LOGIN_MAX_ATTEMPTS):
        r = c.post("/api/auth/login", json={"email": ACCOUNT["email"], "password": "wrong-pass-1"})
        assert r.status_code == 401
    r = c.post("/api/auth/login", json={"email": ACCOUNT["email"], "password": ACCOUNT["password"]})
    assert r.status_code == 429
    auth_module.clear_login_failures("testclient", ACCOUNT["email"])


def test_login_throttle_ignores_spoofed_proxy_headers():
    """Sin TRUST_PROXY las cabeceras de proxy no cambian la IP que se limita."""
    c = TestClient(app)
    register(c)
    c.cookies.clear()
    for i in range(auth_module.LOGIN_MAX_ATTEMPTS):
        c.post(
            "/api/auth/login",
            json={"email": ACCOUNT["email"], "password": "wrong-pass-1"},
            headers={"X-Real-IP": f"10.0.0.{i}", "X-Forwarded-For": f"10.1.0.{i}"},
        )
    r = c.post("/api/auth/login", json={"email": ACCOUNT["email"], "password": ACCOUNT["password"]})
    assert r.status_code == 429
    auth_module.clear_login_failures("testclient", ACCOUNT["email"])


def test_login_throttle_memory_is_bounded(monkeypatch):
    monkeypatch.setattr(auth_module, "LOGIN_TRACKED_MAX", 3)
    auth_module._login_attempts.clear()
    for i in range(10):
        auth_module.record_login_failure("1.2.3.4", f"user{i}@example.com")
    assert len(auth_module._login_attempts) <= 3
    auth_module._login_attempts.clear()


def test_logout_revokes_session_server_side():
    c = TestClient(app)
    register(c)
    token = c.cookies.get(auth_module.SESSION_COOKIE)
    assert c.post("/api/auth/logout").status_code == 204
    c.cookies.set(auth_module.SESSION_COOKIE, token)  # replay the old cookie
    assert c.get("/api/auth/me").status_code == 401


def test_expired_session_is_rejected():
    c = TestClient(app)
    register(c)
    from app.database import _lock, get_connection

    past = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
    with _lock:
        get_connection().execute("UPDATE sessions SET expires_at = ?", (past,))
        get_connection().commit()
    assert c.get("/api/auth/me").status_code == 401


def test_garbage_session_cookie_is_ignored():
    c = TestClient(app)
    c.cookies.set(auth_module.SESSION_COOKIE, "not-a-token!")
    assert c.get("/api/collections").status_code == 200
    assert c.post("/api/auth/logout").status_code == 204


def test_register_rejects_password_over_72_bytes():
    c = TestClient(app)
    r = c.post("/api/auth/register", json={"email": "long@example.com", "password": "ñ" * 40})
    assert r.status_code == 422


def test_google_login_links_existing_password_account(monkeypatch):
    import app.routes_auth as routes_auth

    monkeypatch.setattr(
        routes_auth,
        "verify_google_token",
        lambda cred: {"sub": "g-999", "email": ACCOUNT["email"], "name": "Same"},
    )
    c = TestClient(app)
    me = register(c)
    c.cookies.clear()
    r = c.post("/api/auth/google", json={"credential": "x"})
    assert r.status_code == 200, r.text
    linked = r.json()
    assert linked["id"] == me["id"] and linked["has_password"] and linked["has_google"]
    assert len(c.get("/api/collections").json()) == 1  # no second first-collection


def test_google_token_requires_verified_email(monkeypatch):
    monkeypatch.setattr(auth_module, "GOOGLE_CLIENT_ID", "cid")
    import google.oauth2.id_token as gid

    monkeypatch.setattr(
        gid, "verify_oauth2_token",
        lambda *a, **k: {"sub": "s", "email": "x@example.com", "email_verified": False},
    )
    c = TestClient(app)
    assert c.post("/api/auth/google", json={"credential": "x"}).status_code == 401


def test_google_login_creates_and_links_account(monkeypatch):
    monkeypatch.setattr(
        auth_module,
        "verify_google_token",
        lambda cred: {"sub": "g-123", "email": "G@Example.com", "name": "Gina"},
    )
    import app.routes_auth as routes_auth

    monkeypatch.setattr(routes_auth, "verify_google_token", auth_module.verify_google_token)
    c = TestClient(app)
    r = c.post("/api/auth/google", json={"credential": "x"})
    assert r.status_code == 200, r.text
    me = r.json()
    assert me["email"] == "g@example.com" and me["has_google"] and not me["has_password"]
    assert len(c.get("/api/collections").json()) == 1
    # Same Google account again -> same RetoBox account.
    c2 = TestClient(app)
    assert c2.post("/api/auth/google", json={"credential": "x"}).json()["id"] == me["id"]


def test_google_transport_dependencies_installed():
    """google-auth necesita `requests` en runtime (no lo declara como obligatorio)."""
    import google.auth.transport.requests  # noqa: F401


def test_google_login_disabled_without_client_id():
    c = TestClient(app)
    assert c.get("/api/auth/config").json() == {"google_client_id": None}
    assert c.post("/api/auth/google", json={"credential": "x"}).status_code == 400


# --------------------------------------------------------------------------
# Access control
# --------------------------------------------------------------------------

def test_guest_cannot_create_collections_or_challenges(guest):
    col = preset_collection(guest)
    assert guest.post("/api/collections", json={"name": "X"}).status_code == 401
    assert guest.post(
        "/api/challenges", json={"title": "X", "required_users": 1, "collection_id": col["id"]}
    ).status_code == 401
    assert guest.post("/api/challenges/import", json={"challenges": []}).status_code == 401


def test_presets_are_read_only_even_when_logged_in(client):
    col = preset_collection(client)
    ch = client.get(f"/api/challenges?collection_id={col['id']}").json()[0]
    assert client.put(f"/api/collections/{col['id']}", json={"name": "X"}).status_code == 403
    assert client.delete(f"/api/collections/{col['id']}").status_code == 403
    assert client.post(
        "/api/challenges", json={"title": "X", "required_users": 1, "collection_id": col["id"]}
    ).status_code == 403
    assert client.put(f"/api/challenges/{ch['id']}", json={"title": "X"}).status_code == 404
    assert client.delete(f"/api/challenges/{ch['id']}").status_code == 404


def test_guest_can_play_presets_with_own_state(guest):
    col = preset_collection(guest)
    make_user(guest, "Ana")
    r = guest.post("/api/draw", json={"mode": "random", "collection_id": col["id"]})
    assert r.status_code == 200
    stats = guest.get(f"/api/stats?collection_id={col['id']}").json()
    assert stats["used"] == 1 and stats["users"] == 1
    assert guest.post(f"/api/reset?collection_id={col['id']}").json() == {"reset": 1}


def test_no_identity_rejected_for_owner_scoped_endpoints():
    c = TestClient(app)
    assert c.get("/api/users").status_code == 400
    assert c.post("/api/draw", json={"mode": "random"}).status_code == 400
    assert c.get("/api/collections").status_code == 200


def test_invalid_guest_key_400():
    c = TestClient(app, headers={"X-Guest-Key": "bad key!"})
    assert c.get("/api/users").status_code == 400


# --------------------------------------------------------------------------
# Isolation between owners
# --------------------------------------------------------------------------

def test_accounts_do_not_see_each_others_collections_players_or_state(client):
    other = TestClient(app)
    register(other, email="other@example.com")
    mine = make_collection(client, "Mía")
    make_challenge(client, collection_id=mine["id"])
    make_user(client, "Ana")

    assert all(c["id"] != mine["id"] for c in other.get("/api/collections").json())
    assert other.get(f"/api/challenges?collection_id={mine['id']}").status_code == 404
    assert other.get("/api/users").json() == []
    assert other.put(f"/api/collections/{mine['id']}", json={"name": "Hack"}).status_code == 404
    assert other.delete(f"/api/collections/{mine['id']}").status_code == 404


def test_draw_state_is_per_owner_on_shared_preset(guest):
    col = preset_collection(guest)
    total = len(guest.get(f"/api/challenges?collection_id={col['id']}").json())
    guest.post("/api/draw", json={"mode": "random", "collection_id": col["id"]})
    other = TestClient(app, headers={"X-Guest-Key": "another-guest-key-0002"})
    assert other.get(f"/api/stats?collection_id={col['id']}").json()["used"] == 0
    r = other.post("/api/draw", json={"mode": "random", "collection_id": col["id"]})
    assert r.json()["remaining"] == total - 1


def test_draw_ignores_other_owners_players_and_groups_are_private(guest):
    col = preset_collection(guest)
    other = TestClient(app, headers={"X-Guest-Key": "another-guest-key-0002"})
    foreign_user = make_user(other, "Ajeno")
    foreign_group = other.post("/api/word-groups", json={"name": "Suyo", "words": ["a"]}).json()
    make_user(guest, "Propio")  # con jugadores propios, seleccionar uno ajeno = pool vacío

    r = guest.post(
        "/api/draw",
        json={"mode": "selected", "selected_user_ids": [foreign_user["id"]], "collection_id": col["id"]},
    )
    assert r.status_code == 400
    assert guest.put(f"/api/word-groups/{foreign_group['id']}", json={"name": "X"}).status_code == 404
    assert guest.delete(f"/api/word-groups/{foreign_group['id']}").status_code == 404
    assert guest.delete(f"/api/users/{foreign_user['id']}").status_code == 404


def test_merge_keeps_max_draw_count_on_conflict():
    account_client = TestClient(app)
    register(account_client)
    col = preset_collection(account_client)
    ch = account_client.get(f"/api/challenges?collection_id={col['id']}").json()[0]
    from app.database import _lock, get_connection

    guest_key, account_key = f"g:{GUEST_KEY}", "u:1"
    with _lock:
        conn = get_connection()
        conn.execute("INSERT INTO draw_state VALUES (?, ?, 1)", (account_key, ch["id"]))
        conn.execute("INSERT INTO draw_state VALUES (?, ?, 3)", (guest_key, ch["id"]))
        conn.commit()
        auth_module.merge_guest_into_account(conn, guest_key, 1)
        conn.commit()
        rows = conn.execute(
            "SELECT owner_key, draw_count FROM draw_state WHERE challenge_id = ?", (ch["id"],)
        ).fetchall()
    assert [(r["owner_key"], r["draw_count"]) for r in rows] == [(account_key, 3)]


def test_guest_data_is_merged_on_register_and_login():
    guest = TestClient(app, headers={"X-Guest-Key": GUEST_KEY})
    col = preset_collection(guest)
    make_user(guest, "Ana")
    guest.post("/api/word-groups", json={"name": "Mío", "words": ["a"]})
    guest.post("/api/draw", json={"mode": "random", "collection_id": col["id"]})

    register(guest)  # same client keeps sending X-Guest-Key
    guest.headers.pop("X-Guest-Key")
    assert [u["name"] for u in guest.get("/api/users").json()] == ["Ana"]
    assert any(g["name"] == "Mío" for g in guest.get("/api/word-groups").json())
    assert guest.get(f"/api/stats?collection_id={col['id']}").json()["used"] == 1

    # A later login from a fresh guest merges again.
    fresh = TestClient(app, headers={"X-Guest-Key": "fresh-guest-key-000003"})
    make_user(fresh, "Bea")
    r = fresh.post("/api/auth/login", json={"email": ACCOUNT["email"], "password": ACCOUNT["password"]})
    assert r.status_code == 200
    fresh.headers.pop("X-Guest-Key")
    assert sorted(u["name"] for u in fresh.get("/api/users").json()) == ["Ana", "Bea"]


def test_preset_word_groups_are_read_only(guest):
    seed_presets()
    g = guest.get("/api/word-groups").json()[0]
    assert g["preset"]
    assert guest.put(f"/api/word-groups/{g['id']}", json={"name": "X"}).status_code == 404
    assert guest.delete(f"/api/word-groups/{g['id']}").status_code == 404
