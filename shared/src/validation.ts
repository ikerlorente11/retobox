// Validadores puros que replican las reglas de los modelos Pydantic del backend.
// Lanzan DomainError(422) ante entradas inválidas y devuelven el payload normalizado
// (con título/nombre recortados) listo para persistir.

import { DomainError } from './errors'
import { MESSAGES } from './messages'
import type {
  ChallengeInput,
  ChallengeUpdate,
  CollectionInput,
  CollectionUpdateInput,
  DrawMode,
  DrawRequest,
  UserInput,
  WordGroupInput,
  WordGroupUpdateInput,
} from './types'

interface NormalizedChallenge {
  title: string
  description: string
  required_users: number
  involved_users: number | null
  repeatable: boolean
}

function assertRequiredUsers(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new DomainError(422, MESSAGES.requiredUsersMin)
  }
}

function assertInvolvedUsers(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new DomainError(422, MESSAGES.involvedUsersMin)
  }
}

export function validateChallengeCreate(input: ChallengeInput): NormalizedChallenge {
  const title = (input.title ?? '').trim()
  if (!title) {
    throw new DomainError(422, MESSAGES.titleRequired)
  }
  assertRequiredUsers(input.required_users)
  const involved = input.involved_users ?? null
  if (involved !== null) {
    assertInvolvedUsers(involved)
    if (involved < input.required_users) {
      throw new DomainError(422, MESSAGES.involvedLtRequired)
    }
  }
  return {
    title,
    description: input.description ?? '',
    required_users: input.required_users,
    involved_users: involved,
    repeatable: input.repeatable ?? false,
  }
}

export function validateChallengeUpdate(input: ChallengeUpdate): ChallengeUpdate {
  const out: ChallengeUpdate = {}
  if (input.title !== undefined) {
    const title = (input.title ?? '').trim()
    if (!title) {
      throw new DomainError(422, MESSAGES.titleRequired)
    }
    out.title = title
  }
  if (input.description !== undefined) {
    out.description = input.description
  }
  if (input.required_users !== undefined) {
    assertRequiredUsers(input.required_users)
    out.required_users = input.required_users
  }
  // 'involved_users' presente (incluido null) = se quiere modificar; null lo limpia.
  if ('involved_users' in input) {
    const involved = input.involved_users ?? null
    if (involved !== null) {
      assertInvolvedUsers(involved)
    }
    out.involved_users = involved
  }
  if (input.repeatable !== undefined) {
    out.repeatable = input.repeatable
  }
  return out
}

export function validateUserCreate(input: UserInput): { name: string; color?: string } {
  const name = (input.name ?? '').trim()
  if (!name) {
    throw new DomainError(422, MESSAGES.nameRequired)
  }
  return { name, color: input.color }
}

// Quita espacios, descarta vacías y elimina duplicados (case-insensitive)
// conservando el orden. Espejo de _clean_words del backend.
export function cleanWords(words: readonly string[]): string[] {
  const seen = new Set<string>()
  const cleaned: string[] = []
  for (const word of words) {
    const trimmed = word.trim()
    if (!trimmed) {
      continue
    }
    const key = trimmed.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    cleaned.push(trimmed)
  }
  return cleaned
}

export function validateWordGroupCreate(input: WordGroupInput): {
  name: string
  words: string[]
} {
  const name = (input.name ?? '').trim()
  if (!name) {
    throw new DomainError(422, MESSAGES.groupNameRequired)
  }
  return { name, words: cleanWords(input.words ?? []) }
}

export function validateWordGroupUpdate(
  input: WordGroupUpdateInput,
): WordGroupUpdateInput {
  const out: WordGroupUpdateInput = {}
  if (input.name !== undefined) {
    const name = (input.name ?? '').trim()
    if (!name) {
      throw new DomainError(422, MESSAGES.groupNameRequired)
    }
    out.name = name
  }
  if (input.words !== undefined) {
    out.words = cleanWords(input.words ?? [])
  }
  return out
}

export function validateCollectionCreate(input: CollectionInput): { name: string } {
  const name = (input.name ?? '').trim()
  if (!name) {
    throw new DomainError(422, MESSAGES.collectionNameRequired)
  }
  return { name }
}

export function validateCollectionUpdate(
  input: CollectionUpdateInput,
): CollectionUpdateInput {
  const out: CollectionUpdateInput = {}
  if (input.name !== undefined) {
    const name = (input.name ?? '').trim()
    if (!name) {
      throw new DomainError(422, MESSAGES.collectionNameRequired)
    }
    out.name = name
  }
  return out
}

export function validateDrawRequest(request: DrawRequest): DrawRequest {
  const mode = (request.mode ?? 'random') as DrawMode
  if (mode !== 'random' && mode !== 'selected') {
    throw new DomainError(422, MESSAGES.invalidMode)
  }
  return {
    mode,
    selected_user_ids: request.selected_user_ids,
    collection_id: request.collection_id,
  }
}
