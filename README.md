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
- 🎯 Tres modos de sorteo:
  - **Sin usuarios:** saca un reto al azar.
  - **Aleatorio total:** saca un reto elegible y asigna jugadores al azar.
  - **Usuarios seleccionados:** eliges quién juega y sale un reto compatible.
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
Abre **http://localhost:8050**. Build optimizado (nginx sirve la SPA).
**Arranca vacío**: solo aparecen los retos que añadas desde la app. Datos en el
volumen `retobox_retobox-data`.

## 🔥 Desarrollo con hot reload (Docker)
```bash
docker compose -f docker-compose.dev.yml up -d --build
```
Abre **http://localhost:5173**. Vite con **HMR** + uvicorn `--reload`: edita
archivos en `./frontend` o `./backend` y se recargan solos, sin reconstruir.
**Incluye las 29 tarjetas de ejemplo** (`SEED_DATA=1`).

> Dev y prod son proyectos Docker separados (`retobox-dev` / `retobox`), con
> bases de datos independientes, así que pueden correr a la vez sin pisarse.

### Diferencia de datos (seed)
| Entorno | Puerto | Retos de ejemplo |
|---------|--------|------------------|
| Desarrollo (`docker-compose.dev.yml`) | 5173 | ✅ Sí (`SEED_DATA=1`) |
| Producción (`docker-compose.yml`)     | 8050 | ❌ No (arranca vacío) |

## 🧑‍💻 Desarrollo local (sin Docker)
Backend:
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
SEED_DATA=1 uvicorn app.main:app --reload --port 8000   # SEED_DATA opcional
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
`GET/POST/PUT/DELETE /api/collections` ·
`GET/POST/PUT/DELETE /api/challenges` (+ `POST /api/challenges/import`) ·
`GET/POST/DELETE /api/users` ·
`GET/POST/PUT/DELETE /api/word-groups` (+ `POST /api/word-groups/import`) ·
`POST /api/draw` · `POST /api/reset` · `GET /api/stats` · `GET /api/health`

`/api/challenges`, `/api/draw`, `/api/reset` y `/api/stats` aceptan `collection_id`
para filtrar por la colección activa. Detalle completo en [`CONTRACT.md`](./CONTRACT.md).

## 🧪 Tests
**Backend** (FastAPI `TestClient`) — cubren CRUD de retos/usuarios/colecciones/
grupos, validaciones (422), los 3 casos de elegibilidad de `/draw`, errores
400/404/409, anti-repetición y contador, colecciones (filtrado, dedup por
colección, migración), import/export y stats/reset por colección:
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
- El seed de ejemplo solo se carga si `SEED_DATA` está activo (dev sí, prod no).
- Cada reto pertenece a una **colección**; siempre existe al menos una ("General"), y
  los retos de BD previas se migran a ella automáticamente al arrancar.
- El front guarda en `localStorage` el tema, el estilo de animación, el **idioma** y la
  **colección activa**.
