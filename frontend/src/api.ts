// Cliente API — rutas relativas /api/... (mismo origen vía nginx en prod, proxy en dev)
import type {
  Challenge,
  ChallengeInput,
  ChallengeUpdate,
  DrawRequest,
  DrawResult,
  Stats,
  User,
  UserInput,
} from './types'

const BASE = '/api'

export class ApiError extends Error {
  status: number
  detail: string
  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor.')
  }

  if (res.status === 204) {
    return undefined as T
  }

  let data: unknown = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!res.ok) {
    const detail =
      (data && typeof data === 'object' && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : null) || `Error ${res.status}`
    throw new ApiError(res.status, detail)
  }

  return data as T
}

export const api = {
  // Challenges
  getChallenges: () => request<Challenge[]>('/challenges'),
  createChallenge: (body: ChallengeInput) =>
    request<Challenge>('/challenges', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateChallenge: (id: number, body: ChallengeUpdate) =>
    request<Challenge>(`/challenges/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteChallenge: (id: number) =>
    request<void>(`/challenges/${id}`, { method: 'DELETE' }),

  // Users
  getUsers: () => request<User[]>('/users'),
  createUser: (body: UserInput) =>
    request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteUser: (id: number) =>
    request<void>(`/users/${id}`, { method: 'DELETE' }),

  // Draw / reset / stats
  draw: (body: DrawRequest) =>
    request<DrawResult>('/draw', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  reset: () => request<{ reset: number }>('/reset', { method: 'POST' }),
  getStats: () => request<Stats>('/stats'),
}
