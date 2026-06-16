// Lógica CRÍTICA de sorteo, portada al pie de la letra desde el endpoint /api/draw
// del backend (CONTRACT.md). Función pura: no muta nada ni accede a almacenamiento;
// recibe el estado actual y devuelve el resultado. El repositorio es quien persiste
// el marcado `is_used` del reto elegido.

import { DomainError } from './errors'
import { MESSAGES } from './messages'
import { defaultRng, type Rng } from './rng'
import type { Challenge, DrawRequest, DrawResult, Stats, User } from './types'

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

  // ----- Elegir reto al azar y asignar jugadores -----
  // Solo se asignan usuarios con nombre a quienes REALIZAN el reto; el resto de
  // involucrados queda como participantes anónimos.
  const chosen = rng.choice(eligible)
  const assignedUsers =
    totalUsers > 0 && chosen.required_users > 0
      ? rng.sample(pool, chosen.required_users)
      : []
  let anonymousCount = 0
  if (totalUsers > 0 && chosen.required_users > 0 && chosen.involved_users != null) {
    anonymousCount = Math.max(0, chosen.involved_users - chosen.required_users)
  }

  return {
    // Las repetibles nunca se marcan como usadas.
    challenge: { ...chosen, is_used: chosen.repeatable ? chosen.is_used : true },
    assigned_users: assignedUsers,
    anonymous_count: anonymousCount,
    // remaining = elegibles que seguirían siéndolo con el mismo pool tras esta.
    // Una repetible sigue disponible, así que no se descuenta.
    remaining: eligible.length - (chosen.repeatable ? 0 : 1),
  }
}

export function computeStats(
  challenges: readonly Challenge[],
  users: readonly User[],
): Stats {
  const total = challenges.length
  const used = challenges.filter((challenge) => challenge.is_used).length
  return { total, used, available: total - used, users: users.length }
}
