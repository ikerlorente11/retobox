// Cliente API — rutas relativas /api/... (mismo origen vía nginx en prod, proxy en dev)
import type {
  Challenge,
  ChallengeInput,
  ChallengeUpdate,
  Collection,
  CollectionInput,
  DrawRequest,
  DrawResult,
  ImportResult,
  Stats,
  User,
  UserInput,
  WordGroup,
  WordGroupInput,
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
  // Collections
  getCollections: () => request<Collection[]>('/collections'),
  createCollection: (body: CollectionInput) =>
    request<Collection>('/collections', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateCollection: (id: number, body: CollectionInput) =>
    request<Collection>(`/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteCollection: (id: number) =>
    request<void>(`/collections/${id}`, { method: 'DELETE' }),

  // Challenges
  getChallenges: (collectionId?: number) =>
    request<Challenge[]>(
      collectionId != null
        ? `/challenges?collection_id=${collectionId}`
        : '/challenges',
    ),
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
  importChallenges: (challenges: ChallengeInput[], collectionId?: number) =>
    request<ImportResult>('/challenges/import', {
      method: 'POST',
      body: JSON.stringify({ challenges, collection_id: collectionId }),
    }),

  // Users
  getUsers: () => request<User[]>('/users'),
  createUser: (body: UserInput) =>
    request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteUser: (id: number) =>
    request<void>(`/users/${id}`, { method: 'DELETE' }),

  // Word groups (mezclador)
  getWordGroups: () => request<WordGroup[]>('/word-groups'),
  createWordGroup: (body: WordGroupInput) =>
    request<WordGroup>('/word-groups', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateWordGroup: (id: number, body: Partial<WordGroupInput>) =>
    request<WordGroup>(`/word-groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteWordGroup: (id: number) =>
    request<void>(`/word-groups/${id}`, { method: 'DELETE' }),
  importWordGroups: (groups: WordGroupInput[]) =>
    request<ImportResult>('/word-groups/import', {
      method: 'POST',
      body: JSON.stringify({ groups }),
    }),

  // Draw / reset / stats
  draw: (body: DrawRequest) =>
    request<DrawResult>('/draw', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  reset: (collectionId?: number) =>
    request<{ reset: number }>(
      collectionId != null ? `/reset?collection_id=${collectionId}` : '/reset',
      { method: 'POST' },
    ),
  getStats: (collectionId?: number) =>
    request<Stats>(
      collectionId != null ? `/stats?collection_id=${collectionId}` : '/stats',
    ),
}
