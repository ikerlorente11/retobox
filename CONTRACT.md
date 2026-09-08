# RetoBox — Contrato compartido (FUENTE DE VERDAD)

App de retos al azar tipo tragaperras/dado, con usuarios y reglas de cuántos
jugadores necesita cada reto. Las cartas no repetibles no vuelven a salir hasta resetear;
las repetibles pueden repetir pero con **probabilidad decreciente** (anti-repetición), de modo
que tienden a salir todas antes de repetirse.
UI **bilingüe (castellano por defecto / inglés)**, con selector de idioma en Ajustes.
Tema oscuro, moderno, "chulo".

> ⚠️ **Doble implementación de la lógica.** Estas reglas están implementadas dos
> veces: en el **backend Python** (`backend/app/`, para la web) y en el paquete TS
> **`@retobox/shared`** (`shared/src/`, para la app móvil offline). Cualquier cambio
> de reglas debe aplicarse en **ambos** y mantener verdes los dos suites de tests
> (`backend/tests/` y `shared/tests/`). Los tests **estadísticos del aleatorio** son
> aparte y solo se ejecutan al tocar la lógica de sorteo: `pytest -m random_sim`
> (backend) y `npm run test:random` (shared).

## Arquitectura / servicios (docker compose)
- `api`  → FastAPI + uvicorn, escucha en **0.0.0.0:8000** dentro del contenedor.
- `web`  → React (Vite build) servido por **nginx** en el puerto 80 (expuesto en host **8050**).
           nginx hace proxy de `/api/` → `http://api:8000/api/`.
- DB: **SQLite** en `/data/retobox.db`. Volumen `retobox-data` montado en `/data`.
- Variables backend: `DATABASE_PATH` (default `/data/retobox.db`) · `REPEAT_DECAY`
  (default `0.1`; fuerza del anti-repetición de las cartas repetibles) ·
  `GOOGLE_CLIENT_ID` (login con Google; vacío = desactivado) · `COOKIE_SECURE`
  (`1` tras HTTPS) · `TRUST_PROXY` (`1` = usar `X-Real-IP` de nginx para el throttle de
  login) · `BCRYPT_ROUNDS` (default 12) · `CORS_ORIGINS` (lista separada por comas;
  vacío = solo mismo origen).
- Una BD anterior a la v2 (sin tabla `schema_meta`) se **rechaza al arrancar**: no hay
  migración porque sus datos eran globales y no se pueden atribuir a ningún dueño.

## Identidad y propiedad (web)
Cada petición se atribuye a un **dueño** (`owner_key`):
- **Cuenta** (`u:<account_id>`): cookie de sesión `retobox_session` (httpOnly, SameSite=Lax,
  token opaco; la BD guarda solo su hash; 30 días).
- **Invitado** (`g:<guest_key>`): cabecera `X-Guest-Key` generada por el navegador
  (`[A-Za-z0-9_-]{16,64}`, guardada en localStorage).
- Sin ninguna de las dos solo funcionan las lecturas públicas.

Qué pertenece a quién:
- **Colecciones**: `owner_id` = cuenta, o `NULL` = **preset pública** (solo lectura para todos).
  Crear/editar/borrar colecciones y retos exige cuenta y ser dueño (401 sin sesión, 403 en
  presets, 404 en colecciones de otros). Al registrarse se crea la colección "Mis retos".
- **Jugadores** (`users`), **grupos de Combos** y **estado de sorteo** (`draw_state`) son por
  dueño; los grupos con `owner_key NULL` son presets públicos de solo lectura.
- Al hacer **login/registro** con `X-Guest-Key` presente, los datos del invitado se
  **fusionan** en la cuenta (jugadores y grupos se reasignan; el estado de sorteo conserva
  el mayor `draw_count`).

## Modelo de datos
### Challenge (reto)
```
id: int
title: str            # obligatorio
description: str       # puede ser ""
required_users: int    # >= 1, nº de personas que REALIZAN el reto (se les asigna usuario)
involved_users: int|null  # opcional, nº TOTAL de personas involucradas (realizan + participan)
repeatable: bool       # default false; si true la carta puede salir varias veces en la sesión
is_used: bool          # derivado POR DUEÑO: draw_count > 0 y no repetible
draw_count: int        # POR DUEÑO (tabla draw_state): veces que le ha salido en su sesión.
                       #   Pondera el anti-repetición y alimenta el contador de "sin salir".
                       #   El reset lo devuelve a 0. (interno; la API no lo expone)
created_at: str        # ISO 8601
collection_id: int     # colección a la que pertenece
```
### Collection (colección de retos)
```
id: int
name: str              # obligatorio
owner_id: int|null     # cuenta dueña; null = preset pública (solo lectura)
preset: bool           # derivado: owner_id is null
created_at: str        # ISO 8601
```
Cada reto pertenece a una colección. Las presets públicas existen siempre
(se siembran al arrancar). La colección activa (elegida en el frontend)
filtra la lista de Retos, el sorteo, las stats y el reset.
### Account (cuenta registrada)
```
id: int
email: str             # único, normalizado (trim + minúsculas)
name: str
has_password: bool     # registrada con contraseña (hash bcrypt en BD)
has_google: bool       # enlazada a Google (google_sub en BD)
```
### User (jugador, por dueño)
```
id: int
name: str              # obligatorio
color: str             # hex "#RRGGBB" (avatar de color)
```
### WordGroup (mezclador / juego de combinaciones, por dueño)
```
id: int
name: str              # obligatorio
words: str[]           # palabras del grupo; se limpian (trim), se descartan vacías
                       # y se eliminan duplicados (case-insensitive) conservando orden
preset: bool           # grupo público de solo lectura
created_at: str        # ISO 8601
```
Cada grupo es un "rodillo": en el frontend se seleccionan grupos y al combinar
sale una palabra aleatoria de cada uno (la combinación es 100% del cliente; el
backend solo persiste los grupos).

## API REST (todo bajo prefijo `/api`)
Todas las respuestas en JSON. Mismo origen (nginx / proxy de Vite); CORS solo si se
configura `CORS_ORIGINS`. 🔒 = requiere cuenta · 👤 = requiere dueño (cuenta o invitado).

- `GET    /api/auth/config`           → `{google_client_id: str|null}`
- `POST   /api/auth/register`         body `{email, password (8-128), name?}` → `Account` (201; 409 si el email existe)
- `POST   /api/auth/login`            body `{email, password}` → `Account` (401 si falla; 429 tras 10 fallos / 15 min)
- `POST   /api/auth/google`           body `{credential}` (ID token de Google Identity Services) → `Account`
                                       (crea la cuenta o la enlaza por email; 400 si no hay `GOOGLE_CLIENT_ID`)
- `POST   /api/auth/logout`           → 204 (borra la sesión y la cookie)
- `GET    /api/auth/me`               → `Account` (401 sin sesión)

- `GET    /api/collections`           → `Collection[]` (presets + las de la cuenta, si hay sesión)
- 🔒 `POST   /api/collections`        body `{name}` → `Collection` (201)
- 🔒 `PUT    /api/collections/{id}`   body `{name?}` → `Collection` (403 en presets)
- 🔒 `DELETE /api/collections/{id}`   → 204 (borra también sus retos y su estado; 403 en presets)
- `GET    /api/challenges?collection_id=`  → `Challenge[]` (colecciones visibles; `is_used` del dueño)
- 🔒 `POST   /api/challenges`         body `{title, description?, required_users, involved_users?, repeatable?, collection_id?}` → `Challenge` (201)
- 🔒 `PUT    /api/challenges/{id}`    body `{title?, description?, required_users?, involved_users?, repeatable?}` → `Challenge`
- 🔒 `DELETE /api/challenges/{id}`    → 204
- 🔒 `POST   /api/challenges/import`  body `{challenges: [{title, description?, required_users, involved_users?, repeatable?}], collection_id?}` → `{imported: int, skipped: int}`
                                       Importa retos a una colección (`collection_id`, por defecto la colección por
                                       defecto) evitando duplicados: se omite (cuenta en `skipped`) cualquier reto cuyo
                                       título (sin espacios y sin distinguir mayúsculas) ya exista **en esa colección** o se
                                       repita dentro del propio fichero. Cada reto se valida igual que en `POST /api/challenges`.
- 👤 `GET    /api/users`              → `User[]` (los del dueño)
- 👤 `POST   /api/users`              body `{name, color?}` (color opcional; backend asigna uno si falta) → `User` (201)
- 👤 `DELETE /api/users/{id}`         → 204
- `GET    /api/word-groups`           → `WordGroup[]` (presets + los del dueño)
- 👤 `POST   /api/word-groups`        body `{name, words?}` → `WordGroup` (201)
- 👤 `PUT    /api/word-groups/{id}`   body `{name?, words?}` → `WordGroup` (404 en presets)
- 👤 `DELETE /api/word-groups/{id}`   → 204 (404 en presets)
- 👤 `POST   /api/word-groups/import` body `{groups: [{name, words?}]}` → `{imported: int, skipped: int}`
                                       Importa grupos evitando duplicados (omite los de nombre ya existente,
                                       normalizado; también dentro del propio fichero).
- 👤 `POST   /api/draw`               body `{mode: "random"|"selected", selected_user_ids?: int[], collection_id?}` → `DrawResult`
- 👤 `POST   /api/reset?collection_id=` → `{reset: int}` (borra el `draw_state` del dueño; solo esa colección si se indica)
- 👤 `GET    /api/stats?collection_id=` → `{total: int, used: int, available: int, users: int}` (por colección si se indica)
  - `used` = cartas que **ya han salido** (`draw_count > 0`, incluidas repetibles); `available` = `total - used` = cartas **sin salir**.
- `GET    /api/health`                → `{status:"ok"}`

### DrawResult
```
{
  challenge: Challenge,
  assigned_users: User[],   # los que REALIZAN el reto; vacío si no hay usuarios registrados
  anonymous_count: int,     # participantes adicionales anónimos (involved_users - required_users)
  remaining: int            # cartas que aún NO han salido (draw_count==0) tras esta tirada
}
```

## Lógica de `/draw` (CRÍTICA — respetar al pie de la letra)
Sea `pool` el conjunto de usuarios considerados:
- modo `"random"`  → `pool` = TODOS los usuarios registrados.
- modo `"selected"`→ `pool` = usuarios cuyos id están en `selected_user_ids`.

Sea `needed = involved_users` si está definido, si no `required_users` (umbral de personas
que deben estar presentes para que la carta sea jugable).

Elegibilidad de cartas (`eligible`): una carta cuenta si **no está usada O es repetible**, y además:
1. **Si NO hay usuarios registrados en el sistema** (0 users): se ignora `needed`. `assigned_users = []`.
2. **Si hay usuarios** (modo random o selected): además `needed <= len(pool)`.

Acción:
- Si `eligible` está vacío → **HTTP 409** con `{detail: "No quedan retos disponibles. Reinicia la sesión."}`
- Si no: elegir un reto de `eligible` con **sorteo ponderado (anti-repetición)**. El peso de
  cada carta es `REPEAT_DECAY ** (draw_count - min_draw_count_del_bote)`, con `REPEAT_DECAY`
  configurable (env `REPEAT_DECAY`, **default 0.1**; `1.0` = uniforme, `0.0` = rotación pura).
  Restar el `draw_count` mínimo del bote mantiene los pesos relativos y evita underflow en
  sesiones largas; si la suma de pesos fuese 0 se cae a uniforme. Así las repetibles que aún
  no han salido se priorizan con fuerza y prácticamente no se repite ninguna hasta que han
  salido todas (verificado por simulación: reparto casi uniforme y orden aleatorio).
  Asignar `required_users` usuarios elegidos al azar de `pool` (sin repetir) — solo los que
  REALIZAN el reto. El resto de involucrados (`involved_users - required_users`, si procede)
  se devuelve como `anonymous_count` (anónimos). **Incrementar `draw_count` del reto elegido**
  y, **salvo que sea repetible**, marcarlo `is_used=true`. Devolver `DrawResult`.
- modo `selected` con `selected_user_ids` vacío o nulo → tratar como error 400 `{detail:"Selecciona al menos un usuario."}`
  (salvo que no haya usuarios en el sistema, entonces aplica el caso 1).

`remaining` = nº de cartas que **aún no han salido** (`draw_count == 0`) en el ámbito de
colección tras esta tirada. Es el indicador de progreso del contador: baja hasta 0 cuando han
salido todas, pero **no bloquea el sorteo** (las repetibles siguen siendo elegibles aunque sea 0).

## Reglas de validación
- `required_users` entero >= 1 (rechazar < 1 con 422/400).
- `involved_users` opcional; si se envía, entero >= 1 y **>= `required_users`** (rechazar con 422).
  En `PUT` enviar `null` lo limpia (vuelve a "solo cuenta `required_users`").
- `title` no vacío (rechazar vacío con 422/400).
- Color usuario: si no se envía, backend elige de una paleta agradable.

## Presets públicos
`backend/app/seed.py` define colecciones públicas **en español** (Fiesta clásica, En familia,
Cena de amigos, Físicos, Oficina, Viaje, En pareja, Verdad o reto suave) y grupos de Combos
públicos, cada uno con una `preset_key` estable. Se siembran en cada arranque de forma
idempotente (solo los que falten). Sin jugadores por defecto.

## Tipos TS en frontend (deben reflejar lo de arriba)
`src/types.ts` con `Challenge`, `Collection`, `Account`, `User`, `WordGroup`, `DrawResult`, `Stats`.
Cliente API en `src/api.ts` usando rutas relativas `/api/...` (mismo origen vía nginx), con
`credentials: same-origin` (cookie) y la cabecera `X-Guest-Key` (`src/lib/guest.ts`).
En desarrollo, Vite proxya `/api` → `http://localhost:8000`.
