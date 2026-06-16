"""End-to-end API tests for RetoBox, covering the CONTRACT.md contract:
health, CRUD, validation, the three /draw eligibility cases, error codes,
no-repeat behaviour, reset and stats."""

from conftest import make_challenge, make_collection, make_user

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
# Challenges — import (dedup)
# --------------------------------------------------------------------------

def test_import_inserts_new_challenges(client):
    payload = {
        "challenges": [
            {"title": "Importado A", "required_users": 1},
            {"title": "Importado B", "required_users": 2, "involved_users": 4},
        ]
    }
    r = client.post("/api/challenges/import", json=payload)
    assert r.status_code == 200
    assert r.json() == {"imported": 2, "skipped": 0}
    titles = {c["title"] for c in client.get("/api/challenges").json()}
    assert {"Importado A", "Importado B"} <= titles


def test_import_skips_existing_titles(client):
    make_challenge(client, title="Ya existe")
    payload = {
        "challenges": [
            {"title": "Ya existe", "required_users": 1},  # duplicado -> skip
            {"title": "Nuevo", "required_users": 1},
        ]
    }
    r = client.post("/api/challenges/import", json=payload)
    assert r.json() == {"imported": 1, "skipped": 1}
    # No se duplicó: sigue habiendo un solo "Ya existe".
    titles = [c["title"] for c in client.get("/api/challenges").json()]
    assert titles.count("Ya existe") == 1


def test_import_dedup_is_case_and_space_insensitive(client):
    make_challenge(client, title="Reto Único")
    payload = {"challenges": [{"title": "  reto único  ", "required_users": 1}]}
    r = client.post("/api/challenges/import", json=payload)
    assert r.json() == {"imported": 0, "skipped": 1}


def test_import_dedup_within_file(client):
    payload = {
        "challenges": [
            {"title": "Repetido", "required_users": 1},
            {"title": "repetido", "required_users": 1},  # mismo título -> skip
        ]
    }
    r = client.post("/api/challenges/import", json=payload)
    assert r.json() == {"imported": 1, "skipped": 1}


def test_import_validates_each_challenge_422(client):
    payload = {"challenges": [{"title": "x", "required_users": 0}]}
    assert client.post("/api/challenges/import", json=payload).status_code == 422


def test_import_ignores_volatile_fields(client):
    # id/is_used/created_at del export se ignoran; el reto entra como no usado.
    payload = {
        "challenges": [
            {
                "id": 999,
                "title": "Con basura",
                "required_users": 1,
                "is_used": True,
                "created_at": "2000-01-01T00:00:00Z",
            }
        ]
    }
    r = client.post("/api/challenges/import", json=payload)
    assert r.json() == {"imported": 1, "skipped": 0}
    c = client.get("/api/challenges").json()[0]
    assert c["title"] == "Con basura" and c["is_used"] is False


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
# Collections
# --------------------------------------------------------------------------

def test_create_challenge_assigns_default_collection(client):
    c = make_challenge(client)
    assert c["collection_id"] > 0
    cols = client.get("/api/collections").json()
    assert any(col["id"] == c["collection_id"] for col in cols)


def test_create_and_list_collections(client):
    a = make_collection(client, "Fiesta")
    b = make_collection(client, "Tranqui")
    cols = {col["name"] for col in client.get("/api/collections").json()}
    assert {"Fiesta", "Tranqui"} <= cols
    assert a["id"] != b["id"]


def test_create_collection_empty_name_422(client):
    assert client.post("/api/collections", json={"name": "  "}).status_code == 422


def test_challenges_filtered_by_collection(client):
    col1 = make_collection(client, "Uno")
    col2 = make_collection(client, "Dos")
    make_challenge(client, title="A", collection_id=col1["id"])
    make_challenge(client, title="B", collection_id=col2["id"])
    lst1 = client.get(f"/api/challenges?collection_id={col1['id']}").json()
    assert [c["title"] for c in lst1] == ["A"]
    lst2 = client.get(f"/api/challenges?collection_id={col2['id']}").json()
    assert [c["title"] for c in lst2] == ["B"]


def test_draw_only_uses_selected_collection(client):
    col1 = make_collection(client, "Uno")
    col2 = make_collection(client, "Dos")
    make_challenge(client, title="SoloUno", collection_id=col1["id"])
    make_challenge(client, title="SoloDos", collection_id=col2["id"])
    # Sortear en col1 siempre saca el reto de col1.
    for _ in range(2):
        client.post("/api/reset", json=None)
        body = client.post(
            "/api/draw", json={"mode": "random", "collection_id": col1["id"]}
        ).json()
        assert body["challenge"]["title"] == "SoloUno"


def test_update_and_delete_collection(client):
    col = make_collection(client, "Original")
    r = client.put(f"/api/collections/{col['id']}", json={"name": "Editada"})
    assert r.status_code == 200 and r.json()["name"] == "Editada"
    # Crear otra para poder borrar (no se puede borrar la única).
    make_collection(client, "Otra")
    assert client.delete(f"/api/collections/{col['id']}").status_code == 204


def test_delete_collection_removes_its_challenges(client):
    col = make_collection(client, "Borrable")
    make_collection(client, "Queda")  # para no ser la única
    make_challenge(client, title="Adios", collection_id=col["id"])
    assert client.delete(f"/api/collections/{col['id']}").status_code == 204
    # El reto de esa colección desaparece.
    titles = [c["title"] for c in client.get("/api/challenges").json()]
    assert "Adios" not in titles


def test_cannot_delete_last_collection(client):
    make_challenge(client)  # fuerza la colección por defecto
    cols = client.get("/api/collections").json()
    assert len(cols) == 1
    assert client.delete(f"/api/collections/{cols[0]['id']}").status_code == 409


def test_stats_and_reset_per_collection(client):
    col1 = make_collection(client, "Uno")
    col2 = make_collection(client, "Dos")
    make_challenge(client, title="A", collection_id=col1["id"])
    make_challenge(client, title="B", collection_id=col2["id"])
    client.post("/api/draw", json={"mode": "random", "collection_id": col1["id"]})
    s1 = client.get(f"/api/stats?collection_id={col1['id']}").json()
    assert s1["total"] == 1 and s1["used"] == 1 and s1["available"] == 0
    s2 = client.get(f"/api/stats?collection_id={col2['id']}").json()
    assert s2["used"] == 0
    # Reset solo de col1.
    r = client.post(f"/api/reset?collection_id={col1['id']}")
    assert r.json()["reset"] == 1


# --------------------------------------------------------------------------
# Word groups (mezclador)
# --------------------------------------------------------------------------

def test_create_and_list_word_group(client):
    r = client.post(
        "/api/word-groups",
        json={"name": "Zona", "words": ["Cocina", "Salón", "Jardín"]},
    )
    assert r.status_code == 201, r.text
    g = r.json()
    assert g["id"] > 0
    assert g["name"] == "Zona"
    assert g["words"] == ["Cocina", "Salón", "Jardín"]
    lst = client.get("/api/word-groups").json()
    assert len(lst) == 1 and lst[0]["name"] == "Zona"


def test_create_word_group_empty_name_422(client):
    assert client.post("/api/word-groups", json={"name": "  "}).status_code == 422


def test_create_word_group_defaults_empty_words(client):
    g = client.post("/api/word-groups", json={"name": "Vacío"}).json()
    assert g["words"] == []


def test_word_group_cleans_and_dedups_words(client):
    g = client.post(
        "/api/word-groups",
        json={"name": "Acción", "words": ["  Saltar ", "saltar", "", "Correr"]},
    ).json()
    # Trim + dedup case-insensitive + descarta vacías, conservando orden.
    assert g["words"] == ["Saltar", "Correr"]


def test_update_word_group(client):
    g = client.post("/api/word-groups", json={"name": "Tiempo", "words": ["Ya"]}).json()
    r = client.put(
        f"/api/word-groups/{g['id']}",
        json={"name": "Momento", "words": ["Ahora", "Luego"]},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Momento"
    assert body["words"] == ["Ahora", "Luego"]


def test_update_missing_word_group_404(client):
    assert client.put("/api/word-groups/9999", json={"name": "x"}).status_code == 404


def test_delete_word_group(client):
    g = client.post("/api/word-groups", json={"name": "Borrar"}).json()
    assert client.delete(f"/api/word-groups/{g['id']}").status_code == 204
    assert client.delete(f"/api/word-groups/{g['id']}").status_code == 404
    assert client.get("/api/word-groups").json() == []


def test_import_word_groups_inserts_new(client):
    payload = {
        "groups": [
            {"name": "Zona", "words": ["Cocina", "Salón"]},
            {"name": "Acción", "words": ["Saltar"]},
        ]
    }
    r = client.post("/api/word-groups/import", json=payload)
    assert r.status_code == 200
    assert r.json() == {"imported": 2, "skipped": 0}
    names = {g["name"] for g in client.get("/api/word-groups").json()}
    assert {"Zona", "Acción"} <= names


def test_import_word_groups_skips_existing_name(client):
    client.post("/api/word-groups", json={"name": "Zona", "words": ["A"]})
    payload = {
        "groups": [
            {"name": "  zona  ", "words": ["B"]},  # duplicado (case/space) -> skip
            {"name": "Tiempo", "words": ["Ya"]},
        ]
    }
    r = client.post("/api/word-groups/import", json=payload)
    assert r.json() == {"imported": 1, "skipped": 1}
    names = [g["name"] for g in client.get("/api/word-groups").json()]
    assert names.count("Zona") == 1


def test_import_word_groups_dedup_within_file(client):
    payload = {
        "groups": [
            {"name": "Repe", "words": ["A"]},
            {"name": "repe", "words": ["B"]},  # mismo nombre -> skip
        ]
    }
    r = client.post("/api/word-groups/import", json=payload)
    assert r.json() == {"imported": 1, "skipped": 1}


def test_import_word_groups_validates_each_422(client):
    payload = {"groups": [{"name": "  "}]}
    assert client.post("/api/word-groups/import", json=payload).status_code == 422


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
