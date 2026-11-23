"""Avisos al móvil a través del servicio avisos del homelab (github.com/ikerlorente11/avisos).

Mismo fichero en todas las apps. La app solo cuenta qué ha pasado; qué llega al móvil y con
qué prioridad se decide en la página de avisos. Nunca bloquea ni lanza: sin AVISOS_URL o con
el servicio caído, el aviso se pierde y la app sigue igual.

Variables: AVISOS_URL, AVISOS_TOKEN y AVISOS_APP (el nombre de la app en avisos).
"""
import json
import logging
import os
import threading
import urllib.request

log = logging.getLogger(__name__)


def avisar(tipo: str, titulo: str, texto: str = "", *, usuario: str | None = None, url: str | None = None,
           acciones: list[dict] | None = None, prioridad: str | None = None, app: str | None = None) -> None:
    """Manda el aviso en segundo plano. `acciones`: [{"etiqueta": "Abrir", "url": "https://…"}]."""
    base = os.environ.get("AVISOS_URL", "").rstrip("/")
    token = os.environ.get("AVISOS_TOKEN", "")
    app = app or os.environ.get("AVISOS_APP", "")
    if not (base and token and app):
        return
    evento = {"app": app, "tipo": tipo, "titulo": titulo, "texto": texto, "usuario": usuario,
              "url": url, "acciones": acciones, "prioridad": prioridad}

    def enviar():
        try:
            req = urllib.request.Request(
                f"{base}/api/evento", data=json.dumps(evento).encode(), method="POST",
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
            urllib.request.urlopen(req, timeout=10).close()
        except Exception as e:  # el aviso nunca debe romper la app
            log.warning("aviso %s/%s no enviado: %s", app, tipo, e)

    threading.Thread(target=enviar, name=f"aviso-{tipo}", daemon=True).start()
