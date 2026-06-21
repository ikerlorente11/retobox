"""Tests ESTADÍSTICOS del aleatorio del sorteo (web / backend Python).

Verifican que la ponderación por `draw_count` (anti-repetición) reparte las
cartas repetibles de forma casi uniforme, que salen TODAS en pocas tiradas, que
el ORDEN es aleatorio y que sesiones largas no rompen el sorteo (blindaje contra
underflow de pesos).

Son lentos y NO deterministas por diseño, así que están marcados `random_sim` y
NO se ejecutan en la suite normal (ver pytest.ini). Córrelos cuando cambies la
lógica de sorteo (app/main.py) con:

    pytest -m random_sim -v
"""

import statistics

import pytest

from conftest import make_challenge

pytestmark = pytest.mark.random_sim


def _draw_n(client, n):
    seq = []
    for _ in range(n):
        r = client.post("/api/draw", json={"mode": "random"})
        assert r.status_code == 200, r.text
        seq.append(r.json()["challenge"]["id"])
    return seq


def test_repeatables_reparten_casi_uniforme(client):
    n, draws = 15, 300
    for i in range(n):
        make_challenge(client, title=f"C{i}", repeatable=True)

    seq = _draw_n(client, draws)
    counts = {cid: seq.count(cid) for cid in set(seq)}
    assert len(counts) == n, "deben salir TODAS las cartas"

    values = list(counts.values())
    mean = statistics.mean(values)
    cv = statistics.pstdev(values) / mean
    # Uniforme puro daría CV ~0.25; el decaimiento lo deja muy por debajo.
    assert cv < 0.15, f"reparto poco uniforme: CV={cv:.3f} counts={values}"


def test_cobertura_ve_todas_en_pocas_tiradas(client):
    n = 15
    for i in range(n):
        make_challenge(client, title=f"C{i}", repeatable=True)

    seen, coverage = set(), None
    for i in range(1, n * 3 + 1):
        cid = client.post("/api/draw", json={"mode": "random"}).json()["challenge"]["id"]
        seen.add(cid)
        if len(seen) == n:
            coverage = i
            break
    # Con anti-repetición se ven todas en bastante menos que el doble (uniforme
    # puro rondaría ~3x por el problema del coleccionista de cromos).
    assert coverage is not None and coverage <= n * 2, f"cobertura={coverage}"


def test_el_orden_es_aleatorio(client):
    n = 15
    for i in range(n):
        make_challenge(client, title=f"C{i}", repeatable=True)

    orders = set()
    for _ in range(5):
        client.post("/api/reset")  # reinicia draw_count -> sesión limpia
        seen, order = set(), []
        for _ in range(n * 2):
            cid = client.post("/api/draw", json={"mode": "random"}).json()["challenge"]["id"]
            if cid not in seen:
                seen.add(cid)
                order.append(cid)
            if len(seen) == n:
                break
        orders.add(tuple(order))
    assert len(orders) >= 4, "el orden no varía entre sesiones (¿determinista?)"


def test_sesion_larga_no_rompe(client):
    n = 5
    for i in range(n):
        make_challenge(client, title=f"C{i}", repeatable=True)
    seq = _draw_n(client, 500)  # no debe lanzar (blindaje underflow de pesos)
    assert set(seq) == set(seq[:50]) or len(set(seq)) == n
    assert client.get("/api/stats").json()["used"] == n
