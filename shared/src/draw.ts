// Lógica CRÍTICA de sorteo, portada al pie de la letra desde el endpoint /api/draw
// del backend (CONTRACT.md). Función pura: no muta nada ni accede a almacenamiento;
// recibe el estado actual y devuelve el resultado. El repositorio es quien persiste
// el marcado `is_used` del reto elegido.

import { DomainError } from './errors'
import { MESSAGES } from './messages'
import { defaultRng, type Rng } from './rng'
import type { Challenge, DrawRequest, DrawResult, Stats, User } from './types'

// Factor de decaimiento de probabilidad para cartas repetibles. El peso de una
// carta en el sorteo es REPEAT_DECAY ** (veces ya sacada). Con 0.1, una vista una
// vez es 10x menos probable que una sin ver, etc. Así las repetibles sin salir se
// priorizan con fuerza y prácticamente no se repite ninguna hasta que van saliendo
// las demás. DEBE coincidir con REPEAT_DECAY del backend (CONTRACT.md).
export const REPEAT_DECAY = 0.1

export function selectDraw(
  challenges: readonly Challenge[],
  users: readonly User[],
  request: DrawRequest,
  rng: Rng = defaultRng,
): DrawResult {
  const totalUsers = users.length

  // ----- Conjunto de usuarios considerados (pool) -----
  let pool: User[]
  if (totalUsers === 0) {
    // Caso 1: no hay usuarios en el sistema. Se ignora required_users; no se asigna.
    pool = []
  } else if (request.mode === 'random') {
    pool = [...users]
  } else {
    const ids = request.selected_user_ids ?? []
    if (ids.length === 0) {
      throw new DomainError(400, MESSAGES.selectAtLeastOne)
    }
    const idSet = new Set(ids)
    pool = users.filter((user) => idSet.has(user.id))
    if (pool.length === 0) {
      throw new DomainError(400, MESSAGES.selectAtLeastOne)
    }
  }

  // Si se indica colección, solo se consideran sus retos.
  const scoped =
    request.collection_id != null
      ? challenges.filter((challenge) => challenge.collection_id === request.collection_id)
      : challenges

  // ----- Retos elegibles -----
  // Elegible si no está usado O es repetible (puede salir varias veces). Cuando hay
  // usuarios, el umbral de personas es involved_users si está definido, si no required_users.
  const eligible =
    totalUsers === 0
      ? scoped.filter((challenge) => !challenge.is_used || challenge.repeatable)
      : scoped.filter(
          (challenge) =>
            (!challenge.is_used || challenge.repeatable) &&
            (challenge.involved_users ?? challenge.required_users) <= pool.length,
        )

  if (eligible.length === 0) {
    throw new DomainError(409, MESSAGES.noChallengesLeft)
  }

  // ----- Elegir reto (ponderado por veces ya sorteada) y asignar jugadores -----
  // Las cartas que ya han salido pesan menos: las repetibles sin salir (o menos
  // sacadas) tienen mucha más probabilidad. Restamos el draw_count mínimo del
  // bote para que el menos sacado pese 1.0 y los exponentes no crezcan sin límite
  // en sesiones largas (evita underflow). Réplica del backend (CONTRACT.md).
  // Solo se asignan usuarios con nombre a quienes REALIZAN el reto; el resto de
  // involucrados queda como participantes anónimos.
  const minDrawn = Math.min(...eligible.map((challenge) => challenge.draw_count))
  const weights = eligible.map(
    (challenge) => REPEAT_DECAY ** (challenge.draw_count - minDrawn),
  )
  const chosen = rng.weighted(eligible, weights)
  const assignedUsers =
    totalUsers > 0 && chosen.required_users > 0
      ? rng.sample(pool, chosen.required_users)
      : []
  let anonymousCount = 0
  if (totalUsers > 0 && chosen.required_users > 0 && chosen.involved_users != null) {
    anonymousCount = Math.max(0, chosen.involved_users - chosen.required_users)
  }

  // remaining = cartas que aún NO han salido esta sesión (draw_count === 0) en el
  // ámbito de colección. Es el indicador de progreso del contador: baja hasta 0
  // cuando han salido todas. No bloquea el sorteo (las repetibles siguen siendo
  // elegibles aunque sea 0). El repositorio incrementa draw_count tras esta
  // función, así que descontamos la elegida si era una carta sin salir.
  const unseen = scoped.filter((challenge) => challenge.draw_count === 0).length

  return {
    // Las repetibles nunca se marcan como usadas.
    challenge: { ...chosen, is_used: chosen.repeatable ? chosen.is_used : true },
    assigned_users: assignedUsers,
    anonymous_count: anonymousCount,
    remaining: unseen - (chosen.draw_count === 0 ? 1 : 0),
  }
}

export function computeStats(
  challenges: readonly Challenge[],
  users: readonly User[],
): Stats {
  // "used" = cartas que YA han salido (draw_count > 0), incluidas las repetibles;
  // "available" = las que aún no han salido. Así el contador refleja progreso y
  // llega a 0 cuando han salido todas (el sorteo sigue permitido).
  const total = challenges.length
  const used = challenges.filter((challenge) => challenge.draw_count > 0).length
  return { total, used, available: total - used, users: users.length }
}
