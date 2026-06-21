// Tipos canónicos compartidos web + móvil — reflejan CONTRACT.md (fuente de verdad).

export interface Challenge {
  id: number
  title: string
  description: string
  required_users: number // personas que realizan el reto
  involved_users: number | null // personas totales involucradas (opcional)
  repeatable: boolean // puede salir más de una vez en la misma sesión
  is_used: boolean
  draw_count: number // veces que ha salido esta sesión (pondera el anti-repetición)
  created_at: string // ISO 8601
  collection_id: number // colección a la que pertenece
}

// Colección que agrupa retos (para distintas situaciones)
export interface Collection {
  id: number
  name: string
  created_at: string // ISO 8601
}

export interface CollectionInput {
  name: string
}

export interface CollectionUpdateInput {
  name?: string
}

export interface User {
  id: number
  name: string
  color: string // hex "#RRGGBB"
}

// Grupo de palabras del mezclador (cada grupo es un rodillo en Combos)
export interface WordGroup {
  id: number
  name: string
  words: string[]
  created_at: string // ISO 8601
}

export interface DrawResult {
  challenge: Challenge
  assigned_users: User[] // los que realizan el reto (vacío si no hay usuarios)
  anonymous_count: number // participantes adicionales anónimos (involved - required)
  remaining: number // cartas elegibles restantes tras esta (informativo)
}

export interface Stats {
  total: number
  used: number
  available: number
  users: number
}

export interface ResetResult {
  reset: number
}

// Resultado de importar un fichero de retos
export interface ImportResult {
  imported: number // retos nuevos añadidos
  skipped: number // retos omitidos por estar ya en la BD (duplicados)
}

export type DrawMode = 'random' | 'selected'

export interface DrawRequest {
  mode: DrawMode
  selected_user_ids?: number[]
  collection_id?: number // si se indica, el sorteo solo considera esa colección
}

// Payloads de creación/edición
export interface ChallengeInput {
  title: string
  description?: string
  required_users: number
  involved_users?: number | null
  repeatable?: boolean
  collection_id?: number
}

export interface ChallengeUpdate {
  title?: string
  description?: string
  required_users?: number
  involved_users?: number | null
  repeatable?: boolean
}

export interface UserInput {
  name: string
  color?: string
}

export interface WordGroupInput {
  name: string
  words: string[]
}

export interface WordGroupUpdateInput {
  name?: string
  words?: string[]
}
