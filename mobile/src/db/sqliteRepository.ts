// Repositorio SQLite offline. Implementa RetoBoxRepository de @retobox/shared
// delegando TODA la lógica de negocio (validación, elegibilidad de sorteo, stats,
// colores) en las funciones puras del paquete compartido. SQLite solo persiste;
// la lógica es exactamente la misma que la del backend Python (CONTRACT.md).

import * as SQLite from 'expo-sqlite'
import {
  computeStats,
  pickColor,
  selectDraw,
  seedIfEmpty,
  validateChallengeCreate,
  validateChallengeUpdate,
  validateCollectionCreate,
  validateCollectionUpdate,
  validateDrawRequest,
  validateUserCreate,
  validateWordGroupCreate,
  validateWordGroupUpdate,
  DomainError,
  MESSAGES,
  type Challenge,
  type ChallengeInput,
  type ChallengeUpdate,
  type Collection,
  type CollectionInput,
  type CollectionUpdateInput,
  type DrawRequest,
  type DrawResult,
  type ImportResult,
  type ResetResult,
  type RetoBoxRepository,
  type Stats,
  type User,
  type UserInput,
  type WordGroup,
  type WordGroupInput,
  type WordGroupUpdateInput,
} from '@retobox/shared'

const DATABASE_NAME = 'retobox.db'

interface ChallengeRow {
  id: number
  title: string
  description: string
  required_users: number
  involved_users: number | null
  repeatable: number
  is_used: number
  draw_count: number
  created_at: string
  collection_id: number
}

interface CollectionRow {
  id: number
  name: string
  created_at: string
}

interface UserRow {
  id: number
  name: string
  color: string
}

interface WordGroupRow {
  id: number
  name: string
  words: string // array JSON
  created_at: string
}

function rowToWordGroup(row: WordGroupRow): WordGroup {
  let words: string[] = []
  try {
    const parsed = row.words ? JSON.parse(row.words) : []
    if (Array.isArray(parsed)) {
      words = parsed.filter((w): w is string => typeof w === 'string')
    }
  } catch {
    words = []
  }
  return { id: row.id, name: row.name, words, created_at: row.created_at }
}

function rowToChallenge(row: ChallengeRow): Challenge {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    required_users: row.required_users,
    involved_users: row.involved_users ?? null,
    repeatable: Boolean(row.repeatable),
    is_used: Boolean(row.is_used),
    draw_count: row.draw_count ?? 0,
    created_at: row.created_at,
    collection_id: row.collection_id,
  }
}

function rowToCollection(row: CollectionRow): Collection {
  return { id: row.id, name: row.name, created_at: row.created_at }
}

function rowToUser(row: UserRow): User {
  return { id: row.id, name: row.name, color: row.color }
}

export class SqliteRepository implements RetoBoxRepository {
  private database: SQLite.SQLiteDatabase | null = null

  /**
   * Abre la BD y crea el esquema. Los retos de ejemplo SOLO se siembran en
   * desarrollo (`__DEV__`): en builds de producción la app arranca vacía, igual
   * que la web en prod (que omite el seed salvo SEED_DATA). Así los retos de
   * prueba no llegan nunca a la Play Store.
   */
  async init(): Promise<void> {
    if (this.database) {
      return
    }
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME)
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS challenges (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        title          TEXT    NOT NULL,
        description    TEXT    NOT NULL DEFAULT '',
        required_users INTEGER NOT NULL DEFAULT 1,
        involved_users INTEGER,
        repeatable     INTEGER NOT NULL DEFAULT 0,
        is_used        INTEGER NOT NULL DEFAULT 0,
        draw_count     INTEGER NOT NULL DEFAULT 0,
        created_at     TEXT    NOT NULL,
        collection_id  INTEGER
      );
      CREATE TABLE IF NOT EXISTS collections (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        created_at TEXT    NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id    INTEGER PRIMARY KEY AUTOINCREMENT,
        name  TEXT NOT NULL,
        color TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS word_groups (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        words      TEXT    NOT NULL DEFAULT '[]',
        created_at TEXT    NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_challenges_is_used ON challenges(is_used);
    `)

    // Migraciones aditivas e idempotentes para BD creadas antes de estas columnas
    // (ALTER TABLE ADD COLUMN; nunca recrea ni borra datos). Espejo del backend.
    const cols = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(challenges)',
    )
    const existing = new Set(cols.map((col) => col.name))
    if (!existing.has('involved_users')) {
      await db.execAsync('ALTER TABLE challenges ADD COLUMN involved_users INTEGER')
    }
    if (!existing.has('repeatable')) {
      await db.execAsync(
        'ALTER TABLE challenges ADD COLUMN repeatable INTEGER NOT NULL DEFAULT 0',
      )
    }
    if (!existing.has('collection_id')) {
      await db.execAsync('ALTER TABLE challenges ADD COLUMN collection_id INTEGER')
    }
    if (!existing.has('draw_count')) {
      // Veces que ha salido la carta en la sesión: pondera el anti-repetición.
      await db.execAsync(
        'ALTER TABLE challenges ADD COLUMN draw_count INTEGER NOT NULL DEFAULT 0',
      )
    }
    await db.execAsync(
      'CREATE INDEX IF NOT EXISTS idx_challenges_collection ON challenges(collection_id)',
    )

    // Siempre debe existir al menos una colección. Los retos sin colección
    // (BD previas) se asignan a la colección por defecto "General".
    let defaultRow = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM collections ORDER BY id ASC LIMIT 1',
    )
    if (!defaultRow) {
      const result = await db.runAsync(
        'INSERT INTO collections (name, created_at) VALUES (?, ?)',
        ['General', new Date().toISOString()],
      )
      defaultRow = { id: result.lastInsertRowId }
    }
    await db.runAsync(
      'UPDATE challenges SET collection_id = ? WHERE collection_id IS NULL',
      [defaultRow.id],
    )

    this.database = db

    // Seed solo en desarrollo; producción arranca vacía.
    if (__DEV__) {
      await seedIfEmpty(this)
    }
  }

  private async defaultCollectionId(): Promise<number> {
    const row = await this.db.getFirstAsync<{ id: number }>(
      'SELECT id FROM collections ORDER BY id ASC LIMIT 1',
    )
    if (row) {
      return row.id
    }
    const result = await this.db.runAsync(
      'INSERT INTO collections (name, created_at) VALUES (?, ?)',
      ['General', new Date().toISOString()],
    )
    return result.lastInsertRowId
  }

  private get db(): SQLite.SQLiteDatabase {
    if (!this.database) {
      throw new Error('SqliteRepository.init() no ha sido llamado todavía')
    }
    return this.database
  }

  // ----- Collections -----

  async getCollections(): Promise<Collection[]> {
    const rows = await this.db.getAllAsync<CollectionRow>(
      'SELECT * FROM collections ORDER BY id ASC',
    )
    return rows.map(rowToCollection)
  }

  async createCollection(input: CollectionInput): Promise<Collection> {
    const normalized = validateCollectionCreate(input)
    const createdAt = new Date().toISOString()
    const result = await this.db.runAsync(
      'INSERT INTO collections (name, created_at) VALUES (?, ?)',
      [normalized.name, createdAt],
    )
    return { id: result.lastInsertRowId, name: normalized.name, created_at: createdAt }
  }

  async updateCollection(id: number, input: CollectionUpdateInput): Promise<Collection> {
    const normalized = validateCollectionUpdate(input)
    const existing = await this.db.getFirstAsync<CollectionRow>(
      'SELECT * FROM collections WHERE id = ?',
      [id],
    )
    if (!existing) {
      throw new DomainError(404, MESSAGES.collectionNotFound)
    }
    if (normalized.name !== undefined) {
      await this.db.runAsync('UPDATE collections SET name = ? WHERE id = ?', [
        normalized.name,
        id,
      ])
    }
    const updated = await this.db.getFirstAsync<CollectionRow>(
      'SELECT * FROM collections WHERE id = ?',
      [id],
    )
    return rowToCollection(updated as CollectionRow)
  }

  async deleteCollection(id: number): Promise<void> {
    const existing = await this.db.getFirstAsync<{ id: number }>(
      'SELECT id FROM collections WHERE id = ?',
      [id],
    )
    if (!existing) {
      throw new DomainError(404, MESSAGES.collectionNotFound)
    }
    const countRow = await this.db.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) AS c FROM collections',
    )
    if ((countRow?.c ?? 0) <= 1) {
      throw new DomainError(409, MESSAGES.lastCollection)
    }
    // Borra la colección y los retos que contiene.
    await this.db.runAsync('DELETE FROM challenges WHERE collection_id = ?', [id])
    await this.db.runAsync('DELETE FROM collections WHERE id = ?', [id])
  }

  // ----- Challenges -----

  async getChallenges(collectionId?: number): Promise<Challenge[]> {
    const rows =
      collectionId != null
        ? await this.db.getAllAsync<ChallengeRow>(
            'SELECT * FROM challenges WHERE collection_id = ? ORDER BY id ASC',
            [collectionId],
          )
        : await this.db.getAllAsync<ChallengeRow>(
            'SELECT * FROM challenges ORDER BY id ASC',
          )
    return rows.map(rowToChallenge)
  }

  async createChallenge(input: ChallengeInput): Promise<Challenge> {
    const normalized = validateChallengeCreate(input)
    let collectionId = input.collection_id
    if (collectionId == null) {
      collectionId = await this.defaultCollectionId()
    } else {
      const exists = await this.db.getFirstAsync<{ id: number }>(
        'SELECT id FROM collections WHERE id = ?',
        [collectionId],
      )
      if (!exists) {
        throw new DomainError(404, MESSAGES.collectionNotFound)
      }
    }
    const createdAt = new Date().toISOString()
    const result = await this.db.runAsync(
      'INSERT INTO challenges (title, description, required_users, involved_users, repeatable, is_used, created_at, collection_id) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
      [
        normalized.title,
        normalized.description,
        normalized.required_users,
        normalized.involved_users,
        normalized.repeatable ? 1 : 0,
        createdAt,
        collectionId,
      ],
    )
    return {
      id: result.lastInsertRowId,
      title: normalized.title,
      description: normalized.description,
      required_users: normalized.required_users,
      involved_users: normalized.involved_users,
      repeatable: normalized.repeatable,
      is_used: false,
      draw_count: 0,
      created_at: createdAt,
      collection_id: collectionId,
    }
  }

  async updateChallenge(id: number, input: ChallengeUpdate): Promise<Challenge> {
    const normalized = validateChallengeUpdate(input)
    const existing = await this.db.getFirstAsync<ChallengeRow>(
      'SELECT * FROM challenges WHERE id = ?',
      [id],
    )
    if (!existing) {
      throw new DomainError(404, MESSAGES.challengeNotFound)
    }

    // involved_users >= required_users si ambos quedan definidos tras el update.
    const newRequired = normalized.required_users ?? existing.required_users
    const newInvolved =
      'involved_users' in normalized
        ? (normalized.involved_users ?? null)
        : existing.involved_users
    if (newInvolved != null && newInvolved < newRequired) {
      throw new DomainError(422, MESSAGES.involvedLtRequired)
    }

    const fields: string[] = []
    const values: Array<string | number | null> = []
    if (normalized.title !== undefined) {
      fields.push('title = ?')
      values.push(normalized.title)
    }
    if (normalized.description !== undefined) {
      fields.push('description = ?')
      values.push(normalized.description)
    }
    if (normalized.required_users !== undefined) {
      fields.push('required_users = ?')
      values.push(normalized.required_users)
    }
    if ('involved_users' in normalized) {
      fields.push('involved_users = ?')
      values.push(normalized.involved_users ?? null)
    }
    if (normalized.repeatable !== undefined) {
      fields.push('repeatable = ?')
      values.push(normalized.repeatable ? 1 : 0)
    }
    if (fields.length > 0) {
      values.push(id)
      await this.db.runAsync(
        `UPDATE challenges SET ${fields.join(', ')} WHERE id = ?`,
        values,
      )
    }

    const updated = await this.db.getFirstAsync<ChallengeRow>(
      'SELECT * FROM challenges WHERE id = ?',
      [id],
    )
    return rowToChallenge(updated as ChallengeRow)
  }

  async deleteChallenge(id: number): Promise<void> {
    const result = await this.db.runAsync('DELETE FROM challenges WHERE id = ?', [id])
    if (result.changes === 0) {
      throw new DomainError(404, MESSAGES.challengeNotFound)
    }
  }

  async importChallenges(
    inputs: ChallengeInput[],
    collectionId?: number,
  ): Promise<ImportResult> {
    let targetId = collectionId
    if (targetId == null) {
      targetId = await this.defaultCollectionId()
    } else {
      const exists = await this.db.getFirstAsync<{ id: number }>(
        'SELECT id FROM collections WHERE id = ?',
        [targetId],
      )
      if (!exists) {
        throw new DomainError(404, MESSAGES.collectionNotFound)
      }
    }
    // Dedup por título normalizado DENTRO de esa colección.
    const existing = await this.db.getAllAsync<{ title: string }>(
      'SELECT title FROM challenges WHERE collection_id = ?',
      [targetId],
    )
    const seen = new Set(existing.map((row) => row.title.trim().toLowerCase()))
    let imported = 0
    let skipped = 0
    const createdAt = new Date().toISOString()
    for (const input of inputs) {
      // Valida cada reto igual que al crearlo (lanza DomainError 422 si procede).
      const normalized = validateChallengeCreate(input)
      const key = normalized.title.toLowerCase()
      if (seen.has(key)) {
        skipped++
        continue
      }
      await this.db.runAsync(
        'INSERT INTO challenges (title, description, required_users, involved_users, repeatable, is_used, created_at, collection_id) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
        [
          normalized.title,
          normalized.description,
          normalized.required_users,
          normalized.involved_users,
          normalized.repeatable ? 1 : 0,
          createdAt,
          targetId,
        ],
      )
      seen.add(key)
      imported++
    }
    return { imported, skipped }
  }

  // ----- Users -----

  async getUsers(): Promise<User[]> {
    const rows = await this.db.getAllAsync<UserRow>(
      'SELECT * FROM users ORDER BY id ASC',
    )
    return rows.map(rowToUser)
  }

  async createUser(input: UserInput): Promise<User> {
    const normalized = validateUserCreate(input)
    let color = normalized.color
    if (!color) {
      const row = await this.db.getFirstAsync<{ c: number }>(
        'SELECT COUNT(*) AS c FROM users',
      )
      color = pickColor(row?.c ?? 0)
    }
    const result = await this.db.runAsync(
      'INSERT INTO users (name, color) VALUES (?, ?)',
      [normalized.name, color],
    )
    return { id: result.lastInsertRowId, name: normalized.name, color }
  }

  async deleteUser(id: number): Promise<void> {
    const result = await this.db.runAsync('DELETE FROM users WHERE id = ?', [id])
    if (result.changes === 0) {
      throw new DomainError(404, MESSAGES.userNotFound)
    }
  }

  // ----- Word groups (Combos) -----

  async getWordGroups(): Promise<WordGroup[]> {
    const rows = await this.db.getAllAsync<WordGroupRow>(
      'SELECT * FROM word_groups ORDER BY id ASC',
    )
    return rows.map(rowToWordGroup)
  }

  async createWordGroup(input: WordGroupInput): Promise<WordGroup> {
    const normalized = validateWordGroupCreate(input)
    const createdAt = new Date().toISOString()
    const result = await this.db.runAsync(
      'INSERT INTO word_groups (name, words, created_at) VALUES (?, ?, ?)',
      [normalized.name, JSON.stringify(normalized.words), createdAt],
    )
    return {
      id: result.lastInsertRowId,
      name: normalized.name,
      words: normalized.words,
      created_at: createdAt,
    }
  }

  async updateWordGroup(id: number, input: WordGroupUpdateInput): Promise<WordGroup> {
    const normalized = validateWordGroupUpdate(input)
    const existing = await this.db.getFirstAsync<WordGroupRow>(
      'SELECT * FROM word_groups WHERE id = ?',
      [id],
    )
    if (!existing) {
      throw new DomainError(404, MESSAGES.groupNotFound)
    }
    const fields: string[] = []
    const values: Array<string | number> = []
    if (normalized.name !== undefined) {
      fields.push('name = ?')
      values.push(normalized.name)
    }
    if (normalized.words !== undefined) {
      fields.push('words = ?')
      values.push(JSON.stringify(normalized.words))
    }
    if (fields.length > 0) {
      values.push(id)
      await this.db.runAsync(
        `UPDATE word_groups SET ${fields.join(', ')} WHERE id = ?`,
        values,
      )
    }
    const updated = await this.db.getFirstAsync<WordGroupRow>(
      'SELECT * FROM word_groups WHERE id = ?',
      [id],
    )
    return rowToWordGroup(updated as WordGroupRow)
  }

  async deleteWordGroup(id: number): Promise<void> {
    const result = await this.db.runAsync('DELETE FROM word_groups WHERE id = ?', [id])
    if (result.changes === 0) {
      throw new DomainError(404, MESSAGES.groupNotFound)
    }
  }

  async importWordGroups(inputs: WordGroupInput[]): Promise<ImportResult> {
    // Dedup por nombre normalizado: omite existentes y repetidos en el fichero.
    const existing = await this.db.getAllAsync<{ name: string }>(
      'SELECT name FROM word_groups',
    )
    const seen = new Set(existing.map((row) => row.name.trim().toLowerCase()))
    let imported = 0
    let skipped = 0
    const createdAt = new Date().toISOString()
    for (const input of inputs) {
      const normalized = validateWordGroupCreate(input)
      const key = normalized.name.toLowerCase()
      if (seen.has(key)) {
        skipped++
        continue
      }
      await this.db.runAsync(
        'INSERT INTO word_groups (name, words, created_at) VALUES (?, ?, ?)',
        [normalized.name, JSON.stringify(normalized.words), createdAt],
      )
      seen.add(key)
      imported++
    }
    return { imported, skipped }
  }

  // ----- Draw / reset / stats -----

  async draw(request: DrawRequest): Promise<DrawResult> {
    const normalized = validateDrawRequest(request)
    const [challenges, users] = await Promise.all([
      this.getChallenges(),
      this.getUsers(),
    ])
    // selectDraw aplica la lógica del contrato y lanza DomainError (400/409) si procede.
    const result = selectDraw(challenges, users, normalized)
    // Siempre se incrementa draw_count (baja la probabilidad de repetir y alimenta
    // el contador de "sin salir"); las no repetibles además se marcan como usadas.
    if (result.challenge.repeatable) {
      await this.db.runAsync(
        'UPDATE challenges SET draw_count = draw_count + 1 WHERE id = ?',
        [result.challenge.id],
      )
    } else {
      await this.db.runAsync(
        'UPDATE challenges SET is_used = 1, draw_count = draw_count + 1 WHERE id = ?',
        [result.challenge.id],
      )
    }
    return result
  }

  async reset(collectionId?: number): Promise<ResetResult> {
    // Restaura tanto las usadas como las repetibles ya salidas (draw_count > 0),
    // devolviéndolas todas a "sin salir".
    const result =
      collectionId != null
        ? await this.db.runAsync(
            'UPDATE challenges SET is_used = 0, draw_count = 0 ' +
              'WHERE (is_used = 1 OR draw_count > 0) AND collection_id = ?',
            [collectionId],
          )
        : await this.db.runAsync(
            'UPDATE challenges SET is_used = 0, draw_count = 0 ' +
              'WHERE is_used = 1 OR draw_count > 0',
          )
    return { reset: result.changes }
  }

  async getStats(collectionId?: number): Promise<Stats> {
    const [challenges, users] = await Promise.all([
      this.getChallenges(collectionId),
      this.getUsers(),
    ])
    return computeStats(challenges, users)
  }
}

// Singleton compartido por toda la app.
export const repository = new SqliteRepository()
