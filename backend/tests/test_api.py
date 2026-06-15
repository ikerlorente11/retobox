"""End-to-end API tests for RetoBox, covering the CONTRACT.md contract:
health, CRUD, validation, the three /draw eligibility cases, error codes,
no-repeat behaviour, reset and stats."""

from conftest import make_challenge, make_user

from app.seed import SEED_CHALLENGES, seed_if_empty


# --------------------------------------------------------------------------
# Health & seed
# --------------------------------------------------------------------------

def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_seed_inserts_once_and_is_idempotent(client):
    inserted = seed_if_empty()
    assert inserted == len(SEED_CHALLENGES)
    # second call must not duplicate
    assert seed_if_empty() == 0
    assert len(client.get("/api/challenges").json()) == len(SEED_CHALLENGES)


def test_seed_data_default_off():
    """Prod default: auto-seed disabled unless SEED_DATA is set."""
    from app.main import SEED_DATA
    assert SEED_DATA is False


def test_seed_all_required_users_valid():
    for title, _desc, req in SEED_CHALLENGES:
        assert isinstance(title, str) and title.strip()
        assert req >= 1


# --------------------------------------------------------------------------
# Challenges CRUD + validation
# --------------------------------------------------------------------------

def test_create_and_list_challenge(client):
    c = make_challenge(client, title="Haz 10 flexiones", required_users=2)
    assert c["id"] > 0
    assert c["required_users"] == 2
    assert c["is_used"] is False
    lst = client.get("/api/challenges").json()
    assert len(lst) == 1 and lst[0]["title"] == "Haz 10 flexiones"


def test_create_challenge_trims_title(client):
    c = make_challenge(client, title="   Reto con espacios   ")
    assert c["title"] == "Reto con espacios"


def test_create_challenge_empty_title_422(client):
    assert client.post("/api/challenges", json={"title": "", "required_users": 1}).status_code == 422
    assert client.post("/api/challenges", json={"title": "   ", "required_users": 1}).status_code == 422


def test_create_challenge_required_users_below_one_422(client):
    assert client.post("/api/challenges", json={"title": "x", "required_users": 0}).status_code == 422
    assert client.post("/api/challenges", json={"title": "x", "required_users": -3}).status_code == 422


def test_update_challenge(client):
    c = make_challenge(client, title="Original", required_users=1)
    r = client.put(f"/api/challenges/{c['id']}", json={"title": "Editado", "required_users": 3})
    assert r.status_code == 200
    body = r.json()
    assert body["title"] == "Editado" and body["required_users"] == 3


def test_update_missing_challenge_404(client):
    assert client.put("/api/challenges/99999", json={"title": "x"}).status_code == 404


def test_update_challenge_invalid_required_users_422(client):
    c = make_challenge(client)
    assert client.put(f"/api/challenges/{c['id']}", json={"required_users": 0}).status_code == 422


def test_delete_challenge(client):
    c = make_challenge(client)
    assert client.delete(f"/api/challenges/{c['id']}").status_code == 204
    assert client.delete(f"/api/challenges/{c['id']}").status_code == 404
    assert client.get("/api/challenges").json() == []


# --------------------------------------------------------------------------
# Challenges — repeatable & involved_users
# --------------------------------------------------------------------------

def test_create_challenge_defaults_repeatable_false_involved_null(client):
    c = make_challenge(client)
    assert c["repeatable"] is False
    assert c["involved_users"] is None


def test_create_challenge_with_involved_and_repeatable(client):
    c = make_challenge(client, required_users=2, involved_users=5, repeatable=True)
    assert c["required_users"] == 2
    assert c["involved_users"] == 5
    assert c["repeatable"] is True


def test_create_challenge_involved_below_required_422(client):
    r = client.post(
        "/api/challenges",
        json={"title": "x", "required_users": 3, "involved_users": 2},
    )
    assert r.status_code == 422


def test_update_can_clear_involved_users_with_null(client):
    c = make_challenge(client, required_users=1, involved_users=4)
    r = client.put(f"/api/challenges/{c['id']}", json={"involved_users": None})
    assert r.status_code == 200
    assert r.json()["involved_users"] is None


def test_update_involved_below_required_422(client):
    c = make_challenge(client, required_users=2)
    assert (
        client.put(
            f"/api/challenges/{c['id']}", json={"involved_users": 1}
        ).status_code
        == 422
    )


def test_repeatable_challenge_can_be_drawn_again(client):
    make_challenge(client, title="Repe", repeatable=True)
    # Sin usuarios -> elegible siempre; nunca se marca como usada.
    for _ in range(3):
        body = client.post("/api/draw", json={"mode": "random"}).json()
        assert body["challenge"]["title"] == "Repe"
        assert body["challenge"]["is_used"] is False
        assert body["remaining"] == 1  # sigue contando como disponible
    assert client.get("/api/stats").json()["used"] == 0


def test_draw_eligibility_uses_involved_users(client):
    # 2 realizan, 4 involucradas -> hacen falta 4 presentes para ser elegible.
    make_challenge(client, title="Cuatro", required_users=2, involved_users=4)
    make_user(client, "A")
    make_user(client, "B")
    make_user(client, "C")
    # Solo 3 presentes -> no elegible
    assert client.post("/api/draw", json={"mode": "random"}).status_code == 409
    make_user(client, "D")  # ahora 4
    body = client.post("/api/draw", json={"mode": "random"}).json()
    assert body["challenge"]["title"] == "Cuatro"
    # Solo se asignan los 2 que realizan; el resto anónimo.
    assert len(body["assigned_users"]) == 2
    assert body["anonymous_count"] == 2


def test_draw_anonymous_count_zero_without_involved(client):
    make_challenge(client, title="Solo", required_users=1)
    make_user(client, "A")
    body = client.post("/api/draw", json={"mode": "random"}).json()
    assert body["anonymous_count"] == 0


# --------------------------------------------------------------------------
# Users
# --------------------------------------------------------------------------

def test_create_user_assigns_palette_color(client):
    u = make_user(client, "Iker")
    assert u["name"] == "Iker"
    assert u["color"].startswith("#") and len(u["color"]) == 7


def test_create_user_respects_given_color(client):
    u = make_user(client, "Ana", color="#123456")
    assert u["color"] == "#123456"


def test_create_user_empty_name_422(client):
    assert client.post("/api/users", json={"name": "  "}).status_code == 422


def test_users_get_distinct_palette_colors(client):
    colors = {make_user(client, f"U{i}")["color"] for i in range(5)}
    assert len(colors) == 5  # palette rotation avoids immediate repeats


def test_delete_user(client):
    u = make_user(client, "Borrar")
    assert client.delete(f"/api/users/{u['id']}").status_code == 204
    assert client.get("/api/users").json() == []


# --------------------------------------------------------------------------
# Draw — the three eligibility cases
# --------------------------------------------------------------------------

def test_draw_no_users_returns_challenge_without_assignment(client):
    make_challenge(client, title="Solo reto", required_users=3)
    r = client.post("/api/draw", json={"mode": "random"})
    assert r.status_code == 200
    body = r.json()
    assert body["challenge"]["title"] == "Solo reto"
    assert body["assigned_users"] == []
    # required_users ignored when there are no users in the system
    assert body["remaining"] == 0


def test_draw_marks_challenge_used_and_no_repeat(client):
    ids = {make_challenge(client, title=f"R{i}")["id"] for i in range(3)}
    drawn = set()
    for _ in range(3):
        body = client.post("/api/draw", json={"mode": "random"}).json()
        drawn.add(body["challenge"]["id"])
    assert drawn == ids  # all distinct, no repeats within a session
    # exhausted now
    assert client.post("/api/draw", json={"mode": "random"}).status_code == 409


def test_draw_random_assigns_required_users(client):
    make_challenge(client, title="Pareja", required_users=2)
    for n in ("A", "B", "C"):
        make_user(client, n)
    body = client.post("/api/draw", json={"mode": "random"}).json()
    assert len(body["assigned_users"]) == 2
    ids = [u["id"] for u in body["assigned_users"]]
    assert len(set(ids)) == 2  # no repeated user


def test_draw_random_filters_by_required_users(client):
    # Only 2 users, but challenge needs 3 -> not eligible -> 409
    make_challenge(client, title="Trio", required_users=3)
    make_user(client, "A")
    make_user(client, "B")
    assert client.post("/api/draw", json={"mode": "random"}).status_code == 409


def test_draw_selected_only_eligible_and_assigns_from_pool(client):
    make_challenge(client, title="Individual", required_users=1)
    make_challenge(client, title="Cuarteto", required_users=4)
    u1 = make_user(client, "A")
    make_user(client, "B")
    make_user(client, "C")
    make_user(client, "D")
    # Select just one user -> only required_users<=1 eligible
    body = client.post(
        "/api/draw", json={"mode": "selected", "selected_user_ids": [u1["id"]]}
    ).json()
    assert body["challenge"]["title"] == "Individual"
    assert [u["id"] for u in body["assigned_users"]] == [u1["id"]]


def test_draw_selected_assigns_subset_of_selected(client):
    make_challenge(client, title="Pareja", required_users=2)
    us = [make_user(client, n) for n in ("A", "B", "C", "D")]
    sel = [us[0]["id"], us[1]["id"], us[2]["id"]]
    body = client.post(
        "/api/draw", json={"mode": "selected", "selected_user_ids": sel}
    ).json()
    assert len(body["assigned_users"]) == 2
    for u in body["assigned_users"]:
        assert u["id"] in sel


def test_draw_selected_empty_ids_400(client):
    make_challenge(client)
    make_user(client, "A")
    r = client.post("/api/draw", json={"mode": "selected", "selected_user_ids": []})
    assert r.status_code == 400


def test_draw_409_message(client):
    # no challenges at all
    r = client.post("/api/draw", json={"mode": "random"})
    assert r.status_code == 409
    assert "Reinicia" in r.json()["detail"]


def test_draw_invalid_mode_422(client):
    assert client.post("/api/draw", json={"mode": "bogus"}).status_code == 422


# --------------------------------------------------------------------------
# Reset & stats
# --------------------------------------------------------------------------

def test_reset_restores_all_challenges(client):
    for i in range(4):
        make_challenge(client, title=f"R{i}")
    client.post("/api/draw", json={"mode": "random"})
    client.post("/api/draw", json={"mode": "random"})
    assert client.get("/api/stats").json()["used"] == 2
    r = client.post("/api/reset")
    assert r.status_code == 200
    assert r.json()["reset"] == 2
    stats = client.get("/api/stats").json()
    assert stats["used"] == 0 and stats["available"] == 4


def test_stats_counts(client):
    for i in range(3):
        make_challenge(client, title=f"R{i}")
    make_user(client, "A")
    client.post("/api/draw", json={"mode": "random"})
    stats = client.get("/api/stats").json()
    assert stats == {"total": 3, "used": 1, "available": 2, "users": 1}
