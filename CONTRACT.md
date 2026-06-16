# RetoBox — Contrato compartido (FUENTE DE VERDAD)

App web de retos al azar tipo tragaperras/dado, con usuarios y reglas de cuántos
jugadores necesita cada reto. Las cartas no se repiten entre sesiones hasta resetear.
UI **en español**. Tema oscuro, moderno, "chulo".

## Arquitectura / servicios (docker compose)
- `api`  → FastAPI + uvicorn, escucha en **0.0.0.0:8000** dentro del contenedor.
- `web`  → React (Vite build) servido por **nginx** en el puerto 80 (expuesto en host **8050**).
           nginx hace proxy de `/api/` → `http://api:8000/api/`.
- DB: **SQLite** en `/data/retobox.db`. Volumen `retobox-data` montado en `/data`.
- Variable backend: `DATABASE_PATH` (default `/data/retobox.db`).

## Modelo de datos
### Challenge (reto)
```
id: int
title: str            # obligatorio
description: str       # puede ser ""
required_users: int    # >= 1, nº de personas que REALIZAN el reto (se les asigna usuario)
involved_users: int|null  # opcional, nº TOTAL de personas involucradas (realizan + participan)
repeatable: bool       # default false; si true la carta puede salir varias veces en la sesión
is_used: bool          # default false; true cuando ya ha salido en la sesión (las repetibles nunca se marcan)
created_at: str        # ISO 8601
```
### User
```
id: int
name: str              # obligatorio
color: str             # hex "#RRGGBB" (avatar de color)
```
### WordGroup (mezclador / juego de combinaciones)
```
id: int
name: str              # obligatorio
words: str[]           # palabras del grupo; se limpian (trim), se descartan vacías
                       # y se eliminan duplicados (case-insensitive) conservando orden
created_at: str        # ISO 8601
```
Cada grupo es un "rodillo": en el frontend se seleccionan grupos y al combinar
sale una palabra aleatoria de cada uno (la combinación es 100% del cliente; el
backend solo persiste los grupos).

## API REST (todo bajo prefijo `/api`)
Todas las respuestas en JSON. CORS abierto (`*`) en el backend.

- `GET    /api/challenges`            → `Challenge[]`
- `POST   /api/challenges`            body `{title, description?, required_users, involved_users?, repeatable?}` → `Challenge` (201)
- `PUT    /api/challenges/{id}`       body `{title?, description?, required_users?, involved_users?, repeatable?}` → `Challenge`
- `DELETE /api/challenges/{id}`       → 204
- `POST   /api/challenges/import`     body `{challenges: [{title, description?, required_users, involved_users?, repeatable?}]}` → `{imported: int, skipped: int}`
                                       Importa retos evitando duplicados: se omite (cuenta en `skipped`) cualquier reto
                                       cuyo título (sin espacios y sin distinguir mayúsculas) ya exista en la BD o se repita
                                       dentro del propio fichero. Cada reto se valida igual que en `POST /api/challenges`.
- `GET    /api/users`                 → `User[]`
- `POST   /api/users`                 body `{name, color?}` (color opcional; backend asigna uno si falta) → `User` (201)
- `DELETE /api/users/{id}`            → 204
- `GET    /api/word-groups`           → `WordGroup[]`
- `POST   /api/word-groups`           body `{name, words?}` → `WordGroup` (201)
- `PUT    /api/word-groups/{id}`      body `{name?, words?}` → `WordGroup`
- `DELETE /api/word-groups/{id}`      → 204
- `POST   /api/word-groups/import`    body `{groups: [{name, words?}]}` → `{imported: int, skipped: int}`
                                       Importa grupos evitando duplicados (omite los de nombre ya existente,
                                       normalizado; también dentro del propio fichero).
- `POST   /api/draw`                  body `{mode: "random"|"selected", selected_user_ids?: int[]}` → `DrawResult`
- `POST   /api/reset`                 → `{reset: int}` (nº de cartas reseteadas)
- `GET    /api/stats`                 → `{total: int, used: int, available: int, users: int}`
- `GET    /api/health`                → `{status:"ok"}`

### DrawResult
```
{
  challenge: Challenge,
  assigned_users: User[],   # los que REALIZAN el reto; vacío si no hay usuarios registrados
  anonymous_count: int,     # participantes adicionales anónimos (involved_users - required_users)
  remaining: int            # cartas elegibles que aún quedan tras esta (informativo)
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
- Si no: elegir un reto aleatorio de `eligible`. Asignar `required_users` usuarios elegidos
  al azar de `pool` (sin repetir) — solo los que REALIZAN el reto. El resto de involucrados
  (`involved_users - required_users`, si procede) se devuelve como `anonymous_count` (anónimos).
  Marcar el reto como `is_used=true` **salvo que sea repetible** (las repetibles no se marcan y
  pueden volver a salir). Devolver `DrawResult`.
- modo `selected` con `selected_user_ids` vacío o nulo → tratar como error 400 `{detail:"Selecciona al menos un usuario."}`
  (salvo que no haya usuarios en el sistema, entonces aplica el caso 1).

`remaining` = nº de cartas que seguirían siendo elegibles con el mismo `pool` tras esta tirada
(una carta repetible sigue contando, no se descuenta).

## Reglas de validación
- `required_users` entero >= 1 (rechazar < 1 con 422/400).
- `involved_users` opcional; si se envía, entero >= 1 y **>= `required_users`** (rechazar con 422).
  En `PUT` enviar `null` lo limpia (vuelve a "solo cuenta `required_users`").
- `title` no vacío (rechazar vacío con 422/400).
- Color usuario: si no se envía, backend elige de una paleta agradable.

## Seed inicial
Al crear la BD vacía, insertar ~28 retos variados **en español** (fiesta/divertidos, sanos),
con `required_users` mezclados (muchos 1 y 2, algunos 3 y 4). Sin usuarios por defecto.

## Tipos TS en frontend (deben reflejar lo de arriba)
`src/types.ts` con `Challenge`, `User`, `DrawResult`, `Stats`.
Cliente API en `src/api.ts` usando rutas relativas `/api/...` (mismo origen vía nginx).
En desarrollo, Vite proxya `/api` → `http://localhost:8000`.
