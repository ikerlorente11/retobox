// Tipos compartidos — reflejan CONTRACT.md (fuente de verdad)

export interface Challenge {
  id: number
  title: string
  description: string
  required_users: number
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
  assigned_users: User[] // vacío si no hay usuarios registrados
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
}

export interface ChallengeUpdate {
  title?: string
  description?: string
  required_users?: number
}

export interface UserInput {
  name: string
  color?: string
}

export type RevealStyle = 'slot' | 'dice'

export type Theme = 'dark' | 'light'
