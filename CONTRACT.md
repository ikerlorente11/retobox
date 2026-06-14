# RetoBox — Contrato compartido (FUENTE DE VERDAD)

App web de retos al azar tipo tragaperras/dado, con usuarios y reglas de cuántos
jugadores necesita cada reto. Las cartas no se repiten entre sesiones hasta resetear.
UI **en español**. Tema oscuro, moderno, "chulo".

## Arquitectura / servicios (docker compose)
- `api`  → FastAPI + uvicorn, escucha en **0.0.0.0:8000** dentro del contenedor.
- `web`  → React (Vite build) servido por **nginx** en el puerto 80 (expuesto en host **8080**).
           nginx hace proxy de `/api/` → `http://api:8000/api/`.
- DB: **SQLite** en `/data/retobox.db`. Volumen `retobox-data` montado en `/data`.
- Variable backend: `DATABASE_PATH` (default `/data/retobox.db`).

## Modelo de datos
### Challenge (reto)
```
id: int
title: str            # obligatorio
description: str       # puede ser ""
required_users: int    # >= 1, nº de jugadores que hacen el reto
is_used: bool          # default false; true cuando ya ha salido en la sesión
created_at: str        # ISO 8601
```
### User
```
id: int
name: str              # obligatorio
color: str             # hex "#RRGGBB" (avatar de color)
```

## API REST (todo bajo prefijo `/api`)
Todas las respuestas en JSON. CORS abierto (`*`) en el backend.

- `GET    /api/challenges`            → `Challenge[]`
- `POST   /api/challenges`            body `{title, description?, required_users}` → `Challenge` (201)
- `PUT    /api/challenges/{id}`       body `{title?, description?, required_users?}` → `Challenge`
- `DELETE /api/challenges/{id}`       → 204
- `GET    /api/users`                 → `User[]`
- `POST   /api/users`                 body `{name, color?}` (color opcional; backend asigna uno si falta) → `User` (201)
- `DELETE /api/users/{id}`            → 204
- `POST   /api/draw`                  body `{mode: "random"|"selected", selected_user_ids?: int[]}` → `DrawResult`
- `POST   /api/reset`                 → `{reset: int}` (nº de cartas reseteadas)
- `GET    /api/stats`                 → `{total: int, used: int, available: int, users: int}`
- `GET    /api/health`                → `{status:"ok"}`

### DrawResult
```
{
  challenge: Challenge,
  assigned_users: User[],   # vacío si no hay usuarios registrados
  remaining: int            # cartas elegibles que aún quedan tras esta (informativo)
}
```

## Lógica de `/draw` (CRÍTICA — respetar al pie de la letra)
Sea `pool` el conjunto de usuarios considerados:
- modo `"random"`  → `pool` = TODOS los usuarios registrados.
- modo `"selected"`→ `pool` = usuarios cuyos id están en `selected_user_ids`.

Elegibilidad de cartas (`eligible`):
1. **Si NO hay usuarios registrados en el sistema** (0 users): `eligible` = retos con `is_used=false`
   (se ignora `required_users`). `assigned_users = []`.
2. **Si hay usuarios** (modo random o selected): `eligible` = retos con `is_used=false`
   **Y** `required_users <= len(pool)`.

Acción:
- Si `eligible` está vacío → **HTTP 409** con `{detail: "No quedan retos disponibles. Reinicia la sesión."}`
- Si no: elegir un reto aleatorio de `eligible`. Asignar `required_users` usuarios elegidos
  al azar de `pool` (sin repetir). Marcar el reto como `is_used=true`. Devolver `DrawResult`.
- modo `selected` con `selected_user_ids` vacío o nulo → tratar como error 400 `{detail:"Selecciona al menos un usuario."}`
  (salvo que no haya usuarios en el sistema, entonces aplica el caso 1).

`remaining` = nº de cartas que seguirían siendo elegibles con el mismo `pool` tras marcar esta.

## Reglas de validación
- `required_users` entero >= 1 (rechazar < 1 con 422/400).
- `title` no vacío (rechazar vacío con 422/400).
- Color usuario: si no se envía, backend elige de una paleta agradable.

## Seed inicial
Al crear la BD vacía, insertar ~28 retos variados **en español** (fiesta/divertidos, sanos),
con `required_users` mezclados (muchos 1 y 2, algunos 3 y 4). Sin usuarios por defecto.

## Tipos TS en frontend (deben reflejar lo de arriba)
`src/types.ts` con `Challenge`, `User`, `DrawResult`, `Stats`.
Cliente API en `src/api.ts` usando rutas relativas `/api/...` (mismo origen vía nginx).
En desarrollo, Vite proxya `/api` → `http://localhost:8000`.
