// Contrato de almacenamiento (RetoBoxRepository) y una implementación de referencia
// en memoria. La superficie coincide exactamente con el cliente `api` del frontend,
// de modo que en móvil basta con sustituir el cliente HTTP por uno local sin tocar
// el resto de la app. El repositorio de SQLite (móvil) implementa esta misma interfaz
// delegando la lógica en las funciones puras de este paquete.

import { pickColor } from './colors'
import { computeStats, selectDraw } from './draw'
import { DomainError } from './errors'
import { MESSAGES } from './messages'
import { defaultRng, type Rng } from './rng'
import type {
  Challenge,
  ChallengeInput,
  ChallengeUpdate,
  Collection,
  CollectionInput,
  CollectionUpdateInput,
  DrawRequest,
  DrawResult,
  ImportResult,
  ResetResult,
  Stats,
  User,
  UserInput,
  WordGroup,
  WordGroupInput,
  WordGroupUpdateInput,
} from './types'
import {
  validateChallengeCreate,
  validateChallengeUpdate,
  validateCollectionCreate,
  validateCollectionUpdate,
  validateDrawRequest,
  validateUserCreate,
  validateWordGroupCreate,
  validateWordGroupUpdate,
} from './validation'

export interface RetoBoxRepository {
  getCollections(): Promise<Collection[]>
  createCollection(input: CollectionInput): Promise<Collection>
  updateCollection(id: number, input: CollectionUpdateInput): Promise<Collection>
  deleteCollection(id: number): Promise<void>

  getChallenges(collectionId?: number): Promise<Challenge[]>
  createChallenge(input: ChallengeInput): Promise<Challenge>
  updateChallenge(id: number, input: ChallengeUpdate): Promise<Challenge>
  deleteChallenge(id: number): Promise<void>
  importChallenges(inputs: ChallengeInput[], collectionId?: number): Promise<ImportResult>

  getUsers(): Promise<User[]>
  createUser(input: UserInput): Promise<User>
  deleteUser(id: number): Promise<void>

  getWordGroups(): Promise<WordGroup[]>
  createWordGroup(input: WordGroupInput): Promise<WordGroup>
  updateWordGroup(id: number, input: WordGroupUpdateInput): Promise<WordGroup>
  deleteWordGroup(id: number): Promise<void>
  importWordGroups(inputs: WordGroupInput[]): Promise<ImportResult>

  draw(request: DrawRequest): Promise<DrawResult>
  reset(collectionId?: number): Promise<ResetResult>
  getStats(collectionId?: number): Promise<Stats>
}

function clone<T>(value: T): T {
  return { ...value }
}

/**
 * Implementación de referencia en memoria. Sirve como contrato ejecutable
 * (los tests de paridad corren contra ella) y como fallback. No persiste entre
 * sesiones; el repositorio SQLite del móvil reproduce este mismo comportamiento.
 */
export class InMemoryRepository implements RetoBoxRepository {
  private readonly challenges: Challenge[] = []
  private readonly users: User[] = []
  private readonly wordGroups: WordGroup[] = []
  private readonly collections: Collection[] = []
  private nextChallengeId = 1
  private nextUserId = 1
  private nextGroupId = 1
  private nextCollectionId = 1
  private readonly rng: Rng

  constructor(rng: Rng = defaultRng) {
    this.rng = rng
    // Siempre debe existir al menos una colección ("General").
    this.collections.push({
      id: this.nextCollectionId++,
      name: 'General',
      created_at: new Date().toISOString(),
    })
  }

  private get defaultCollectionId(): number {
    return this.collections[0]!.id
  }

  // ----- Colecciones -----

  async getCollections(): Promise<Collection[]> {
    return this.collections.map(clone)
  }

  async createCollection(input: CollectionInput): Promise<Collection> {
    const normalized = validateCollectionCreate(input)
    const collection: Collection = {
      id: this.nextCollectionId++,
      name: normalized.name,
      created_at: new Date().toISOString(),
    }
    this.collections.push(collection)
    return clone(collection)
  }

  async updateCollection(id: number, input: CollectionUpdateInput): Promise<Collection> {
    const normalized = validateCollectionUpdate(input)
    const collection = this.collections.find((item) => item.id === id)
    if (!collection) {
      throw new DomainError(404, MESSAGES.collectionNotFound)
    }
    if (normalized.name !== undefined) {
      collection.name = normalized.name
    }
    return clone(collection)
  }

  async deleteCollection(id: number): Promise<void> {
    const index = this.collections.findIndex((item) => item.id === id)
    if (index === -1) {
      throw new DomainError(404, MESSAGES.collectionNotFound)
    }
    if (this.collections.length <= 1) {
      throw new DomainError(409, MESSAGES.lastCollection)
    }
    // Borra la colección y los retos que contiene.
    this.collections.splice(index, 1)
    for (let i = this.challenges.length - 1; i >= 0; i--) {
      if (this.challenges[i]!.collection_id === id) {
        this.challenges.splice(i, 1)
      }
    }
  }

  // ----- Retos -----

  async getChallenges(collectionId?: number): Promise<Challenge[]> {
    const list =
      collectionId != null
        ? this.challenges.filter((c) => c.collection_id === collectionId)
        : this.challenges
    return list.map(clone)
  }

  async createChallenge(input: ChallengeInput): Promise<Challenge> {
    const normalized = validateChallengeCreate(input)
    let collectionId = input.collection_id
    if (collectionId == null) {
      collectionId = this.defaultCollectionId
    } else if (!this.collections.some((c) => c.id === collectionId)) {
      throw new DomainError(404, MESSAGES.collectionNotFound)
    }
    const challenge: Challenge = {
      id: this.nextChallengeId++,
      title: normalized.title,
      description: normalized.description,
      required_users: normalized.required_users,
      involved_users: normalized.involved_users,
      repeatable: normalized.repeatable,
      is_used: false,
      created_at: new Date().toISOString(),
      collection_id: collectionId,
    }
    this.challenges.push(challenge)
    return clone(challenge)
  }

  async updateChallenge(id: number, input: ChallengeUpdate): Promise<Challenge> {
    const normalized = validateChallengeUpdate(input)
    const challenge = this.challenges.find((item) => item.id === id)
    if (!challenge) {
      throw new DomainError(404, MESSAGES.challengeNotFound)
    }
    // involved_users >= required_users si ambos quedan definidos tras el update.
    const newRequired = normalized.required_users ?? challenge.required_users
    const newInvolved =
      'involved_users' in normalized
        ? (normalized.involved_users ?? null)
        : challenge.involved_users
    if (newInvolved != null && newInvolved < newRequired) {
      throw new DomainError(422, MESSAGES.involvedLtRequired)
    }
    if (normalized.title !== undefined) {
      challenge.title = normalized.title
    }
    if (normalized.description !== undefined) {
      challenge.description = normalized.description
    }
    if (normalized.required_users !== undefined) {
      challenge.required_users = normalized.required_users
    }
    if ('involved_users' in normalized) {
      challenge.involved_users = normalized.involved_users ?? null
    }
    if (normalized.repeatable !== undefined) {
      challenge.repeatable = normalized.repeatable
    }
    return clone(challenge)
  }

  async deleteChallenge(id: number): Promise<void> {
    const index = this.challenges.findIndex((item) => item.id === id)
    if (index === -1) {
      throw new DomainError(404, MESSAGES.challengeNotFound)
    }
    this.challenges.splice(index, 1)
  }

  async importChallenges(
    inputs: ChallengeInput[],
    collectionId?: number,
  ): Promise<ImportResult> {
    let targetId = collectionId
    if (targetId == null) {
      targetId = this.defaultCollectionId
    } else if (!this.collections.some((c) => c.id === targetId)) {
      throw new DomainError(404, MESSAGES.collectionNotFound)
    }
    // Dedup por título normalizado DENTRO de esa colección: omite los que ya
    // existen y los repetidos dentro del propio fichero.
    const seen = new Set(
      this.challenges
        .filter((c) => c.collection_id === targetId)
        .map((c) => c.title.trim().toLowerCase()),
    )
    let imported = 0
    let skipped = 0
    for (const input of inputs) {
      const normalized = validateChallengeCreate(input)
      const key = normalized.title.toLowerCase()
      if (seen.has(key)) {
        skipped++
        continue
      }
      this.challenges.push({
        id: this.nextChallengeId++,
        title: normalized.title,
        description: normalized.description,
        required_users: normalized.required_users,
        involved_users: normalized.involved_users,
        repeatable: normalized.repeatable,
        is_used: false,
        created_at: new Date().toISOString(),
        collection_id: targetId,
      })
      seen.add(key)
      imported++
    }
    return { imported, skipped }
  }

  async getUsers(): Promise<User[]> {
    return this.users.map(clone)
  }

  async createUser(input: UserInput): Promise<User> {
    const normalized = validateUserCreate(input)
    const color = normalized.color ? normalized.color : pickColor(this.users.length)
    const user: User = { id: this.nextUserId++, name: normalized.name, color }
    this.users.push(user)
    return clone(user)
  }

  async deleteUser(id: number): Promise<void> {
    const index = this.users.findIndex((item) => item.id === id)
    if (index === -1) {
      throw new DomainError(404, MESSAGES.userNotFound)
    }
    this.users.splice(index, 1)
  }

  async getWordGroups(): Promise<WordGroup[]> {
    return this.wordGroups.map((group) => ({ ...group, words: [...group.words] }))
  }

  async createWordGroup(input: WordGroupInput): Promise<WordGroup> {
    const normalized = validateWordGroupCreate(input)
    const group: WordGroup = {
      id: this.nextGroupId++,
      name: normalized.name,
      words: normalized.words,
      created_at: new Date().toISOString(),
    }
    this.wordGroups.push(group)
    return { ...group, words: [...group.words] }
  }

  async updateWordGroup(id: number, input: WordGroupUpdateInput): Promise<WordGroup> {
    const normalized = validateWordGroupUpdate(input)
    const group = this.wordGroups.find((item) => item.id === id)
    if (!group) {
      throw new DomainError(404, MESSAGES.groupNotFound)
    }
    if (normalized.name !== undefined) {
      group.name = normalized.name
    }
    if (normalized.words !== undefined) {
      group.words = normalized.words
    }
    return { ...group, words: [...group.words] }
  }

  async deleteWordGroup(id: number): Promise<void> {
    const index = this.wordGroups.findIndex((item) => item.id === id)
    if (index === -1) {
      throw new DomainError(404, MESSAGES.groupNotFound)
    }
    this.wordGroups.splice(index, 1)
  }

  async importWordGroups(inputs: WordGroupInput[]): Promise<ImportResult> {
    // Dedup por nombre normalizado: omite los ya existentes y los repetidos
    // dentro del propio fichero.
    const seen = new Set(this.wordGroups.map((g) => g.name.trim().toLowerCase()))
    let imported = 0
    let skipped = 0
    for (const input of inputs) {
      const normalized = validateWordGroupCreate(input)
      const key = normalized.name.toLowerCase()
      if (seen.has(key)) {
        skipped++
        continue
      }
      this.wordGroups.push({
        id: this.nextGroupId++,
        name: normalized.name,
        words: normalized.words,
        created_at: new Date().toISOString(),
      })
      seen.add(key)
      imported++
    }
    return { imported, skipped }
  }

  async draw(request: DrawRequest): Promise<DrawResult> {
    const normalized = validateDrawRequest(request)
    const result = selectDraw(this.challenges, this.users, normalized, this.rng)
    const challenge = this.challenges.find((item) => item.id === result.challenge.id)
    // Las repetibles no se marcan como usadas: siguen disponibles en la sesión.
    if (challenge && !challenge.repeatable) {
      challenge.is_used = true
    }
    return result
  }

  async reset(collectionId?: number): Promise<ResetResult> {
    let count = 0
    for (const challenge of this.challenges) {
      if (collectionId != null && challenge.collection_id !== collectionId) {
        continue
      }
      if (challenge.is_used) {
        challenge.is_used = false
        count++
      }
    }
    return { reset: count }
  }

  async getStats(collectionId?: number): Promise<Stats> {
    const scoped =
      collectionId != null
        ? this.challenges.filter((c) => c.collection_id === collectionId)
        : this.challenges
    return computeStats(scoped, this.users)
  }
}
