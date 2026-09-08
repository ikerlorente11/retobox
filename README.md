# 🎲 RetoBox

App de **retos al azar** tipo tragaperras / dado, con usuarios y reglas de cuántos
jugadores necesita cada reto. Las cartas no repetibles **no vuelven a salir** hasta reiniciar;
las repetibles pueden repetir pero con **probabilidad decreciente**, de modo que tienden a salir
todas antes de repetirse. Pensada para usar en el móvil en fiestas.

Disponible como **app web** (React + FastAPI) y como **app móvil Android offline**
(Expo / React Native), que comparten la lógica de negocio vía el paquete
[`@retobox/shared`](./shared). La app móvil funciona con su **propia base de datos
SQLite**, sin backend ni conexión. Ver [`mobile/README.md`](./mobile/README.md).

## ✨ Características
- 🎰 Revelado animado con dos estilos elegibles: **máquina tragaperras** y **dado 3D**.
- 👥 Gestión de usuarios (avatares de color).
- 🃏 Gestión de retos, indicando **cuántos jugadores** necesita cada uno.
- 🗂️ **Colecciones de retos:** agrupa los retos por situaciones y elige la **colección activa**
  (en Retos), que filtra la lista, el sorteo, las estadísticas y el reinicio.
- 🌐 **Colecciones públicas** listas para jugar (Fiesta, En familia, Cena de amigos, Físicos,
  Oficina, Viaje, En pareja, Verdad o reto suave) y grupos de Combos públicos.
- 🔐 **Cuentas (web):** regístrate con email y contraseña o con **Google** para crear y guardar
  tus propias colecciones. Sin cuenta puedes jugar como invitado: tus jugadores, Combos y
  progreso del sorteo son solo tuyos (por navegador) y se fusionan en tu cuenta al entrar.
- 🎯 Tres modos de sorteo:
  - **Sin usuarios:** saca un reto al azar.
  - **Aleatorio total:** saca un reto elegible y asigna jugadores al azar.
  - **Usuarios seleccionados:** eliges quién juega y sale un reto compatible.
- 👯 **Sortea un compañero:** en el popup del reto, un "roll" tipo tragaperras elige al azar
  a otra persona (de las que no han salido, todos los usuarios menos los asignados) para que
  lo haga con quien le ha tocado; se puede volver a tirar. Es 100% del cliente (web y móvil).
- 🚫 Filtrado: solo salen retos realizables con los usuarios disponibles.
- 🔁 **Anti-repetición:** las no repetibles no vuelven hasta **Reiniciar sesión**; las repetibles
  salen con probabilidad decreciente (tienden a salir todas antes de repetir). El contador muestra
  cuántas quedan **sin salir** y, al llegar a 0, las repetibles siguen saliendo. Ajustable con la
  variable de entorno `REPEAT_DECAY` (default `0.1`).
- 🔀 **Combos (mezclador):** crea grupos de palabras y, al jugar, salen varias tragaperras/dados
  con una combinación al azar.
- 📤 **Exportar / importar** retos (de la colección activa) y grupos de Combos a fichero, con dedup.
- 🌍 **Bilingüe castellano / inglés** con selector en Ajustes (por defecto castellano).
- 🌙☀️ **Tema oscuro neón y tema claro** elegibles en Ajustes (se recuerda entre sesiones).
- 💎 Glassmorphism, responsive (móvil y tablet), microinteracciones y confeti.

## 🏗️ Stack
- **Frontend:** React + Vite + TypeScript, Tailwind CSS, Framer Motion, Zustand.
- **Backend:** FastAPI + SQLite (Python 3.11).
- **Despliegue:** Docker Compose (nginx sirve la SPA y proxya `/api` al backend).

## 🚀 Producción (Docker)
```bash
docker compose up -d --build
```
Abre **http://localhost:8050**. Build optimizado (nginx sirve la SPA). Al arrancar se
crean las **colecciones públicas**; el resto de datos pertenece a cada cuenta o invitado.
Datos en el volumen `retobox_retobox-data`.

Variables en un fichero `.env` junto al compose (plantilla en `.env.example`; `.env` no se versiona):
- `GOOGLE_CLIENT_ID`: Client ID OAuth de tipo *Aplicación web* (Google Cloud → Credenciales),
  con tu origen (`http://localhost:8050`, `https://tu-dominio`) en *Orígenes de JavaScript
  autorizados*. Vacío = el botón de Google no aparece.
- `COOKIE_SECURE=1` cuando la web se sirva por **HTTPS** (cookie de sesión con `Secure`).

> ⚠️ **Actualizar desde la v1**: la base de datos antigua (sin cuentas) no es compatible y el
> backend se niega a arrancar con ella. Haz copia del volumen y bórralo:
> `docker compose down -v` y vuelve a levantar.

## 🔥 Desarrollo con hot reload (Docker)
```bash
docker compose -f docker-compose.dev.yml up -d --build
```
Abre **http://localhost:5173**. Vite con **HMR** + uvicorn `--reload`: edita
archivos en `./frontend` o `./backend` y se recargan solos, sin reconstruir.

> Dev y prod son proyectos Docker separados (`retobox-dev` / `retobox`), con
> bases de datos independientes, así que pueden correr a la vez sin pisarse.

## 🧑‍💻 Desarrollo local (sin Docker)
Backend:
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000   # GOOGLE_CLIENT_ID=... opcional
```
Frontend (en otra terminal):
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173 (proxya /api a :8000)
```

## 📁 Estructura
```
retobox/
├── docker-compose.yml          # despliegue de producción (nginx + api), :8050
├── docker-compose.dev.yml      # desarrollo con hot reload (Vite + uvicorn --reload), :5173
├── CONTRACT.md                 # contrato compartido (modelo + API + lógica de sorteo)
├── backend/                    # FastAPI + SQLite (web)
│   ├── app/                    # main.py, database.py, models.py, seed.py
│   ├── tests/                  # suite pytest del contrato + tests del aleatorio (gateados)
│   ├── requirements.txt
│   ├── requirements-dev.txt    # + pytest, httpx
│   └── Dockerfile
├── frontend/                   # React + Vite + Tailwind (web)
│   ├── src/                    # pages/, components/, store.ts, api.ts, types.ts
│   ├── Dockerfile              # build de producción (multi-stage -> nginx)
│   ├── Dockerfile.dev          # dev server con HMR
│   └── nginx.conf              # SPA + proxy /api
├── shared/                     # @retobox/shared: tipos + lógica de negocio en TS
│   ├── src/                    # draw.ts, validation.ts, repository.ts, seed.ts…
│   └── tests/                  # paridad con el backend + tests del aleatorio (gateados)
└── mobile/                     # Expo / React Native (Android offline, SQLite local)
    ├── app/                    # rutas expo-router (tabs)
    ├── src/                    # db/, ui/, components/, store.ts, theme.ts
    └── eas.json                # perfiles de build (APK/AAB) para Play Store
```

## 🔌 API (resumen)
`/api/auth/{config,register,login,google,logout,me}` ·
`GET/POST/PUT/DELETE /api/collections` ·
`GET/POST/PUT/DELETE /api/challenges` (+ `POST /api/challenges/import`) ·
`GET/POST/DELETE /api/users` ·
`GET/POST/PUT/DELETE /api/word-groups` (+ `POST /api/word-groups/import`) ·
`POST /api/draw` · `POST /api/reset` · `GET /api/stats` · `GET /api/health`

`/api/challenges`, `/api/draw`, `/api/reset` y `/api/stats` aceptan `collection_id`
para filtrar por la colección activa. Crear o modificar colecciones y retos requiere
sesión (cookie); jugadores, Combos, sorteo y stats van por dueño (cuenta o invitado vía
cabecera `X-Guest-Key`). Detalle completo en [`CONTRACT.md`](./CONTRACT.md).

## 🧪 Tests
**Backend** (FastAPI `TestClient`) — cubren CRUD de retos/usuarios/colecciones/
grupos, validaciones (422), los 3 casos de elegibilidad de `/draw`, errores
400/404/409, anti-repetición y contador, colecciones (filtrado, dedup por
colección), import/export, stats/reset por colección, y cuentas (registro, login,
Google, throttle, fusión de invitado, aislamiento entre dueños, presets de solo lectura):
```bash
cd backend
pip install -r requirements-dev.txt
pytest tests/ -v               # suite normal (los tests del aleatorio quedan fuera)
pytest -m random_sim -v        # tests ESTADÍSTICOS del aleatorio (solo al tocar el sorteo)
```
**Shared** (`@retobox/shared`, **Vitest**) — paridad con el backend: misma lógica
de negocio (sorteo, validaciones, colecciones, import/export) que usa la app móvil:
```bash
cd shared
npm install
npm test                       # suite normal
npm run test:random            # tests ESTADÍSTICOS del aleatorio (solo al tocar el sorteo)
```
**Frontend** (**Vitest** + jsdom) — i18n (`translate`, errores del backend),
parsers de importar/exportar (retos y grupos), utilidades de color y arranque del store:
```bash
cd frontend
npm test           # vitest run
npm run build      # typecheck (tsc -b) + build de producción
```

> Los tests del **aleatorio** (`random_sim` en backend, `test:random` en shared) son
> estadísticos y no deterministas, así que están **fuera de la suite normal**: ejecútalos
> solo cuando cambies la lógica de sorteo (`backend/app/main.py`, `shared/src/draw.ts`).

## 🩺 Arquitectura
- nginx (servicio `web`) sirve la SPA y hace `proxy_pass` de `/api/` → `api:8000`
  (mismo origen, sin CORS en el navegador).
- El backend persiste en SQLite (`DATABASE_PATH`, por defecto `/data/retobox.db`)
  sobre un volumen Docker; el acceso se serializa con un lock para SQLite.
- Las **colecciones públicas** se siembran al arrancar (idempotente, `backend/app/seed.py`).
- Cada reto pertenece a una **colección**: pública (solo lectura) o de una cuenta. El estado
  del sorteo, los jugadores y los grupos de Combos son **por dueño** (cuenta o invitado).
- Sesión con cookie httpOnly (token opaco, hash en BD); contraseñas con bcrypt; login con
  Google verificando el ID token en el backend.
- El front guarda en `localStorage` el tema, el estilo de animación, el **idioma**, la
  **colección activa** y la **clave de invitado**.

## Licencia

Puedes usar, modificar y compartir este proyecto libremente para fines **no comerciales**.
No está permitido venderlo ni ganar dinero con él. Ver [LICENSE](LICENSE) (PolyForm Noncommercial 1.0.0).
