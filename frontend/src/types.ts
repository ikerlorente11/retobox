// Tipos compartidos — reflejan CONTRACT.md (fuente de verdad)

export interface Challenge {
  id: number
  title: string
  description: string
  required_users: number // personas que realizan el reto
  involved_users: number | null // personas totales involucradas (opcional)
  repeatable: boolean // puede salir más de una vez en la misma sesión
  is_used: boolean
  created_at: string
}

export interface User {
  id: number
  name: string
  color: string // hex "#RRGGBB"
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

export type DrawMode = 'random' | 'selected'

export interface DrawRequest {
  mode: DrawMode
  selected_user_ids?: number[]
}

// Payloads de creación/edición
export interface ChallengeInput {
  title: string
  description?: string
  required_users: number
  involved_users?: number | null
  repeatable?: boolean
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

// Resultado de importar un fichero de retos
export interface ImportResult {
  imported: number // retos nuevos añadidos
  skipped: number // retos omitidos por estar ya en la BD (duplicados)
}

export type RevealStyle = 'slot' | 'dice'

export type Theme = 'dark' | 'light'
