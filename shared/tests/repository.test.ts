// Tests de paridad con backend/tests/test_api.py: cubren CRUD, validaciones (422),
// los 3 casos de elegibilidad de draw, errores 400/404/409, no-repetición, reset
// y stats. Garantizan que la lógica offline (TS) se comporta igual que la API (Python).

import { beforeEach, describe, expect, it } from 'vitest'

import {
  buildGroupsFileContent,
  buildRetosFileContent,
  InMemoryRepository,
  MESSAGES,
  parseGroupsFile,
  parseRetosFile,
  SEED_CHALLENGES,
  seedIfEmpty,
  type RetoBoxRepository,
} from '../src/index'
import { firstRng } from './rng.fixture'

let repo: RetoBoxRepository

beforeEach(() => {
  repo = new InMemoryRepository()
})

async function expectStatus(promise: Promise<unknown>, status: number): Promise<void> {
  await expect(promise).rejects.toMatchObject({ status })
}

function makeChallenge(
  repository: RetoBoxRepository,
  title = 'Reto de prueba',
  description = '',
  requiredUsers = 1,
  extra: { involved_users?: number | null; repeatable?: boolean } = {},
) {
  return repository.createChallenge({
    title,
    description,
    required_users: requiredUsers,
    ...extra,
  })
}

function makeUser(repository: RetoBoxRepository, name: string, color?: string) {
  return repository.createUser(color !== undefined ? { name, color } : { name })
}

// --------------------------------------------------------------------------
// Seed
// --------------------------------------------------------------------------

describe('seed', () => {
  it('inserta una vez y es idempotente', async () => {
    expect(await seedIfEmpty(repo)).toBe(SEED_CHALLENGES.length)
    expect(await seedIfEmpty(repo)).toBe(0)
    expect(await repo.getChallenges()).toHaveLength(SEED_CHALLENGES.length)
  })

  it('todos los retos del seed son válidos', () => {
    for (const challenge of SEED_CHALLENGES) {
      expect(challenge.title.trim().length).toBeGreaterThan(0)
      expect(challenge.required_users).toBeGreaterThanOrEqual(1)
    }
  })
})

// --------------------------------------------------------------------------
// Challenges CRUD + validación
// --------------------------------------------------------------------------

describe('challenges', () => {
  it('crea y lista', async () => {
    const created = await makeChallenge(repo, 'Haz 10 flexiones', '', 2)
    expect(created.id).toBeGreaterThan(0)
    expect(created.required_users).toBe(2)
    expect(created.is_used).toBe(false)
    const list = await repo.getChallenges()
    expect(list).toHaveLength(1)
    expect(list[0]?.title).toBe('Haz 10 flexiones')
  })

  it('recorta el título', async () => {
    const created = await makeChallenge(repo, '   Reto con espacios   ')
    expect(created.title).toBe('Reto con espacios')
  })

  it('título vacío -> 422', async () => {
    await expectStatus(repo.createChallenge({ title: '', required_users: 1 }), 422)
    await expectStatus(repo.createChallenge({ title: '   ', required_users: 1 }), 422)
  })

  it('required_users < 1 -> 422', async () => {
    await expectStatus(repo.createChallenge({ title: 'x', required_users: 0 }), 422)
    await expectStatus(repo.createChallenge({ title: 'x', required_users: -3 }), 422)
  })

  it('actualiza', async () => {
    const created = await makeChallenge(repo, 'Original', '', 1)
    const updated = await repo.updateChallenge(created.id, {
      title: 'Editado',
      required_users: 3,
    })
    expect(updated.title).toBe('Editado')
    expect(updated.required_users).toBe(3)
  })

  it('actualizar inexistente -> 404', async () => {
    await expectStatus(repo.updateChallenge(99999, { title: 'x' }), 404)
  })

  it('actualizar con required_users inválido -> 422', async () => {
    const created = await makeChallenge(repo)
    await expectStatus(repo.updateChallenge(created.id, { required_users: 0 }), 422)
  })

  it('borra (y segundo borrado -> 404)', async () => {
    const created = await makeChallenge(repo)
    await expect(repo.deleteChallenge(created.id)).resolves.toBeUndefined()
    await expectStatus(repo.deleteChallenge(created.id), 404)
    expect(await repo.getChallenges()).toEqual([])
  })
})

// --------------------------------------------------------------------------
// Challenges — repeatable & involved_users
// --------------------------------------------------------------------------

describe('repeatable & involved_users', () => {
  it('por defecto repeatable=false e involved_users=null', async () => {
    const c = await makeChallenge(repo)
    expect(c.repeatable).toBe(false)
    expect(c.involved_users).toBeNull()
  })

  it('crea con involved_users y repeatable', async () => {
    const c = await makeChallenge(repo, 'Fiesta', '', 2, {
      involved_users: 5,
      repeatable: true,
    })
    expect(c.required_users).toBe(2)
    expect(c.involved_users).toBe(5)
    expect(c.repeatable).toBe(true)
  })

  it('involved_users < required_users -> 422', async () => {
    await expectStatus(
      repo.createChallenge({ title: 'x', required_users: 3, involved_users: 2 }),
      422,
    )
  })

  it('update puede limpiar involved_users con null', async () => {
    const c = await makeChallenge(repo, 'x', '', 1, { involved_users: 4 })
    const updated = await repo.updateChallenge(c.id, { involved_users: null })
    expect(updated.involved_users).toBeNull()
  })

  it('update con involved_users < required_users -> 422', async () => {
    const c = await makeChallenge(repo, 'x', '', 2)
    await expectStatus(repo.updateChallenge(c.id, { involved_users: 1 }), 422)
  })

  it('una carta repetible puede salir varias veces y no se marca usada', async () => {
    await makeChallenge(repo, 'Repe', '', 1, { repeatable: true })
    for (let i = 0; i < 3; i++) {
      const body = await repo.draw({ mode: 'random' })
      expect(body.challenge.title).toBe('Repe')
      expect(body.challenge.is_used).toBe(false)
      expect(body.remaining).toBe(1)
    }
    expect((await repo.getStats()).used).toBe(0)
  })

  it('la elegibilidad usa involved_users', async () => {
    await makeChallenge(repo, 'Cuatro', '', 2, { involved_users: 4 })
    await makeUser(repo, 'A')
    await makeUser(repo, 'B')
    await makeUser(repo, 'C')
    // Solo 3 presentes -> no elegible
    await expectStatus(repo.draw({ mode: 'random' }), 409)
    await makeUser(repo, 'D') // ahora 4
    const body = await repo.draw({ mode: 'random' })
    expect(body.challenge.title).toBe('Cuatro')
    expect(body.assigned_users).toHaveLength(2)
    expect(body.anonymous_count).toBe(2)
  })

  it('anonymous_count es 0 sin involved_users', async () => {
    await makeChallenge(repo, 'Solo', '', 1)
    await makeUser(repo, 'A')
    const body = await repo.draw({ mode: 'random' })
    expect(body.anonymous_count).toBe(0)
  })
})

// --------------------------------------------------------------------------
// Challenges — import (dedup)
// --------------------------------------------------------------------------

describe('import', () => {
  it('inserta retos nuevos', async () => {
    const res = await repo.importChallenges([
      { title: 'Importado A', required_users: 1 },
      { title: 'Importado B', required_users: 2, involved_users: 4 },
    ])
    expect(res).toEqual({ imported: 2, skipped: 0 })
    const titles = (await repo.getChallenges()).map((c) => c.title)
    expect(titles).toContain('Importado A')
    expect(titles).toContain('Importado B')
  })

  it('omite títulos ya existentes', async () => {
    await makeChallenge(repo, 'Ya existe')
    const res = await repo.importChallenges([
      { title: 'Ya existe', required_users: 1 },
      { title: 'Nuevo', required_users: 1 },
    ])
    expect(res).toEqual({ imported: 1, skipped: 1 })
    const titles = (await repo.getChallenges()).map((c) => c.title)
    expect(titles.filter((t) => t === 'Ya existe')).toHaveLength(1)
  })

  it('dedup ignora mayúsculas y espacios', async () => {
    await makeChallenge(repo, 'Reto Único')
    const res = await repo.importChallenges([{ title: '  reto único  ', required_users: 1 }])
    expect(res).toEqual({ imported: 0, skipped: 1 })
  })

  it('dedup dentro del propio fichero', async () => {
    const res = await repo.importChallenges([
      { title: 'Repetido', required_users: 1 },
      { title: 'repetido', required_users: 1 },
    ])
    expect(res).toEqual({ imported: 1, skipped: 1 })
  })

  it('valida cada reto -> 422', async () => {
    await expectStatus(
      repo.importChallenges([{ title: 'x', required_users: 0 }]),
      422,
    )
  })

  it('los retos importados entran como no usados', async () => {
    const res = await repo.importChallenges([{ title: 'Con basura', required_users: 1 }])
    expect(res).toEqual({ imported: 1, skipped: 0 })
    const challenge = (await repo.getChallenges()).find((c) => c.title === 'Con basura')
    expect(challenge?.is_used).toBe(false)
  })
})

// --------------------------------------------------------------------------
// retosFile — exportar / importar (round-trip)
// --------------------------------------------------------------------------

describe('retosFile', () => {
  it('round-trip: exportar y volver a parsear conserva los retos', async () => {
    await makeChallenge(repo, 'Reto X', 'desc', 2, { involved_users: 3, repeatable: true })
    const content = buildRetosFileContent(await repo.getChallenges())
    const parsed = parseRetosFile(content)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toMatchObject({
      title: 'Reto X',
      description: 'desc',
      required_users: 2,
      involved_users: 3,
      repeatable: true,
    })
  })

  it('acepta una lista pelada de retos', () => {
    const parsed = parseRetosFile(JSON.stringify([{ title: 'Suelto', required_users: 1 }]))
    expect(parsed[0]?.title).toBe('Suelto')
  })

  it('JSON inválido lanza error', () => {
    expect(() => parseRetosFile('{no json')).toThrow()
  })

  it('sin retos válidos lanza error', () => {
    expect(() => parseRetosFile(JSON.stringify([{ noTitle: true }]))).toThrow()
  })
})

// --------------------------------------------------------------------------
// Word groups (Combos)
// --------------------------------------------------------------------------

describe('word groups', () => {
  it('crea y lista', async () => {
    const g = await repo.createWordGroup({ name: 'Zona', words: ['Cocina', 'Salón'] })
    expect(g.id).toBeGreaterThan(0)
    expect(g.name).toBe('Zona')
    expect(g.words).toEqual(['Cocina', 'Salón'])
    expect(await repo.getWordGroups()).toHaveLength(1)
  })

  it('limpia palabras: trim, vacías y duplicados (case-insensitive) conservando orden', async () => {
    const g = await repo.createWordGroup({
      name: '  Acción  ',
      words: ['  Correr ', '', 'Saltar', 'correr', 'CORRER', 'Saltar'],
    })
    expect(g.name).toBe('Acción')
    expect(g.words).toEqual(['Correr', 'Saltar'])
  })

  it('nombre vacío -> 422', async () => {
    await expectStatus(repo.createWordGroup({ name: '   ', words: [] }), 422)
  })

  it('actualiza nombre y palabras', async () => {
    const g = await repo.createWordGroup({ name: 'G', words: ['a'] })
    const updated = await repo.updateWordGroup(g.id, { name: 'G2', words: ['x', 'y'] })
    expect(updated.name).toBe('G2')
    expect(updated.words).toEqual(['x', 'y'])
  })

  it('actualizar inexistente -> 404', async () => {
    await expectStatus(repo.updateWordGroup(9999, { name: 'x' }), 404)
  })

  it('borra (y segundo borrado -> 404)', async () => {
    const g = await repo.createWordGroup({ name: 'Borrar', words: [] })
    await expect(repo.deleteWordGroup(g.id)).resolves.toBeUndefined()
    await expectStatus(repo.deleteWordGroup(g.id), 404)
  })

  it('import omite duplicados por nombre (BD y dentro del fichero)', async () => {
    await repo.createWordGroup({ name: 'Existe', words: ['a'] })
    const res = await repo.importWordGroups([
      { name: 'Existe', words: ['b'] }, // duplicado en BD
      { name: 'Nuevo', words: ['c'] },
      { name: 'nuevo', words: ['d'] }, // duplicado dentro del fichero
    ])
    expect(res).toEqual({ imported: 1, skipped: 2 })
    expect(await repo.getWordGroups()).toHaveLength(2)
  })
})

describe('groupsFile', () => {
  it('round-trip exportar/parsear conserva grupos', async () => {
    await repo.createWordGroup({ name: 'Zona', words: ['Cocina', 'Salón'] })
    const parsed = parseGroupsFile(buildGroupsFileContent(await repo.getWordGroups()))
    expect(parsed[0]).toEqual({ name: 'Zona', words: ['Cocina', 'Salón'] })
  })

  it('acepta lista pelada y descarta sin nombre', () => {
    const parsed = parseGroupsFile(
      JSON.stringify([{ name: 'A', words: ['x'] }, { words: ['y'] }]),
    )
    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.name).toBe('A')
  })

  it('JSON inválido lanza error', () => {
    expect(() => parseGroupsFile('nope')).toThrow()
  })
})

// --------------------------------------------------------------------------
// Colecciones
// --------------------------------------------------------------------------

describe('collections', () => {
  it('existe la colección por defecto "General"', async () => {
    const cols = await repo.getCollections()
    expect(cols).toHaveLength(1)
    expect(cols[0]?.name).toBe('General')
  })

  it('los retos nuevos van a la colección por defecto', async () => {
    const c = await makeChallenge(repo, 'Reto')
    const def = (await repo.getCollections())[0]!
    expect(c.collection_id).toBe(def.id)
  })

  it('crea colección y filtra retos por colección', async () => {
    const def = (await repo.getCollections())[0]!
    const fiesta = await repo.createCollection({ name: 'Fiesta' })
    await repo.createChallenge({ title: 'A', required_users: 1 }) // default
    await repo.createChallenge({ title: 'B', required_users: 1, collection_id: fiesta.id })
    expect(await repo.getChallenges(def.id)).toHaveLength(1)
    expect(await repo.getChallenges(fiesta.id)).toHaveLength(1)
    expect(await repo.getChallenges()).toHaveLength(2)
  })

  it('crear reto con colección inexistente -> 404', async () => {
    await expectStatus(
      repo.createChallenge({ title: 'X', required_users: 1, collection_id: 9999 }),
      404,
    )
  })

  it('renombra colección; inexistente -> 404', async () => {
    const def = (await repo.getCollections())[0]!
    const updated = await repo.updateCollection(def.id, { name: 'Base' })
    expect(updated.name).toBe('Base')
    await expectStatus(repo.updateCollection(9999, { name: 'x' }), 404)
  })

  it('borrar la única colección -> 409', async () => {
    const def = (await repo.getCollections())[0]!
    await expectStatus(repo.deleteCollection(def.id), 409)
  })

  it('borrar colección elimina también sus retos', async () => {
    const fiesta = await repo.createCollection({ name: 'Fiesta' })
    await repo.createChallenge({ title: 'A', required_users: 1, collection_id: fiesta.id })
    await repo.deleteCollection(fiesta.id)
    expect(await repo.getCollections()).toHaveLength(1)
    expect(await repo.getChallenges()).toHaveLength(0)
  })

  it('draw solo considera la colección indicada', async () => {
    const def = (await repo.getCollections())[0]!
    const otra = await repo.createCollection({ name: 'Otra' })
    await repo.createChallenge({ title: 'EnDefault', required_users: 1, collection_id: def.id })
    await repo.createChallenge({ title: 'EnOtra', required_users: 1, collection_id: otra.id })
    const result = await repo.draw({ mode: 'random', collection_id: otra.id })
    expect(result.challenge.title).toBe('EnOtra')
  })

  it('stats y reset por colección', async () => {
    const def = (await repo.getCollections())[0]!
    const otra = await repo.createCollection({ name: 'Otra' })
    await repo.createChallenge({ title: 'D1', required_users: 1, collection_id: def.id })
    await repo.createChallenge({ title: 'O1', required_users: 1, collection_id: otra.id })
    await repo.createChallenge({ title: 'O2', required_users: 1, collection_id: otra.id })
    await repo.draw({ mode: 'random', collection_id: otra.id })
    expect(await repo.getStats(otra.id)).toEqual({ total: 2, used: 1, available: 1, users: 0 })
    expect(await repo.getStats(def.id)).toEqual({ total: 1, used: 0, available: 1, users: 0 })
    const { reset } = await repo.reset(otra.id)
    expect(reset).toBe(1)
    expect((await repo.getStats(def.id)).used).toBe(0)
  })

  it('import dedup por colección', async () => {
    const def = (await repo.getCollections())[0]!
    const otra = await repo.createCollection({ name: 'Otra' })
    await repo.createChallenge({ title: 'Repetido', required_users: 1, collection_id: def.id })
    // En 'otra' no existe -> se importa aunque exista en default.
    const res = await repo.importChallenges([{ title: 'Repetido', required_users: 1 }], otra.id)
    expect(res).toEqual({ imported: 1, skipped: 0 })
  })
})

// --------------------------------------------------------------------------
// Users
// --------------------------------------------------------------------------

describe('users', () => {
  it('asigna color de paleta', async () => {
    const user = await makeUser(repo, 'Iker')
    expect(user.name).toBe('Iker')
    expect(user.color.startsWith('#')).toBe(true)
    expect(user.color).toHaveLength(7)
  })

  it('respeta el color indicado', async () => {
    const user = await makeUser(repo, 'Ana', '#123456')
    expect(user.color).toBe('#123456')
  })

  it('nombre vacío -> 422', async () => {
    await expectStatus(repo.createUser({ name: '  ' }), 422)
  })

  it('5 usuarios reciben colores distintos', async () => {
    const colors = new Set<string>()
    for (let i = 0; i < 5; i++) {
      colors.add((await makeUser(repo, `U${i}`)).color)
    }
    expect(colors.size).toBe(5)
  })

  it('borra usuario', async () => {
    const user = await makeUser(repo, 'Borrar')
    await expect(repo.deleteUser(user.id)).resolves.toBeUndefined()
    expect(await repo.getUsers()).toEqual([])
  })
})

// --------------------------------------------------------------------------
// Draw — los tres casos de elegibilidad
// --------------------------------------------------------------------------

describe('draw', () => {
  it('sin usuarios devuelve reto sin asignación', async () => {
    await makeChallenge(repo, 'Solo reto', '', 3)
    const result = await repo.draw({ mode: 'random' })
    expect(result.challenge.title).toBe('Solo reto')
    expect(result.assigned_users).toEqual([])
    expect(result.remaining).toBe(0)
  })

  it('marca el reto como usado y no repite', async () => {
    const ids = new Set<number>()
    for (let i = 0; i < 3; i++) {
      ids.add((await makeChallenge(repo, `R${i}`)).id)
    }
    const drawn = new Set<number>()
    for (let i = 0; i < 3; i++) {
      drawn.add((await repo.draw({ mode: 'random' })).challenge.id)
    }
    expect(drawn).toEqual(ids)
    await expectStatus(repo.draw({ mode: 'random' }), 409)
  })

  it('modo random asigna required_users distintos', async () => {
    await makeChallenge(repo, 'Pareja', '', 2)
    for (const name of ['A', 'B', 'C']) {
      await makeUser(repo, name)
    }
    const result = await repo.draw({ mode: 'random' })
    expect(result.assigned_users).toHaveLength(2)
    const ids = result.assigned_users.map((u) => u.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('modo random filtra por required_users -> 409', async () => {
    await makeChallenge(repo, 'Trio', '', 3)
    await makeUser(repo, 'A')
    await makeUser(repo, 'B')
    await expectStatus(repo.draw({ mode: 'random' }), 409)
  })

  it('modo selected solo elegibles y asigna del pool', async () => {
    // RNG determinista: con dos elegibles posibles, fijamos el resultado.
    const deterministic = new InMemoryRepository(firstRng)
    await makeChallenge(deterministic, 'Individual', '', 1)
    await makeChallenge(deterministic, 'Cuarteto', '', 4)
    const u1 = await makeUser(deterministic, 'A')
    await makeUser(deterministic, 'B')
    await makeUser(deterministic, 'C')
    await makeUser(deterministic, 'D')
    const result = await deterministic.draw({
      mode: 'selected',
      selected_user_ids: [u1.id],
    })
    expect(result.challenge.title).toBe('Individual')
    expect(result.assigned_users.map((u) => u.id)).toEqual([u1.id])
  })

  it('modo selected asigna un subconjunto de los seleccionados', async () => {
    await makeChallenge(repo, 'Pareja', '', 2)
    const us = []
    for (const name of ['A', 'B', 'C', 'D']) {
      us.push(await makeUser(repo, name))
    }
    const sel = [us[0]!.id, us[1]!.id, us[2]!.id]
    const result = await repo.draw({ mode: 'selected', selected_user_ids: sel })
    expect(result.assigned_users).toHaveLength(2)
    for (const user of result.assigned_users) {
      expect(sel).toContain(user.id)
    }
  })

  it('modo selected con ids vacíos -> 400', async () => {
    await makeChallenge(repo)
    await makeUser(repo, 'A')
    await expectStatus(repo.draw({ mode: 'selected', selected_user_ids: [] }), 400)
  })

  it('sin retos -> 409 con mensaje de reinicio', async () => {
    await expect(repo.draw({ mode: 'random' })).rejects.toMatchObject({
      status: 409,
      message: MESSAGES.noChallengesLeft,
    })
  })

  it('modo inválido -> 422', async () => {
    await expectStatus(
      repo.draw({ mode: 'bogus' as unknown as 'random' }),
      422,
    )
  })
})

// --------------------------------------------------------------------------
// Reset & stats
// --------------------------------------------------------------------------

describe('reset & stats', () => {
  it('reset restaura todos los retos usados', async () => {
    for (let i = 0; i < 4; i++) {
      await makeChallenge(repo, `R${i}`)
    }
    await repo.draw({ mode: 'random' })
    await repo.draw({ mode: 'random' })
    expect((await repo.getStats()).used).toBe(2)
    const result = await repo.reset()
    expect(result.reset).toBe(2)
    const stats = await repo.getStats()
    expect(stats.used).toBe(0)
    expect(stats.available).toBe(4)
  })

  it('stats cuenta correctamente', async () => {
    for (let i = 0; i < 3; i++) {
      await makeChallenge(repo, `R${i}`)
    }
    await makeUser(repo, 'A')
    await repo.draw({ mode: 'random' })
    expect(await repo.getStats()).toEqual({ total: 3, used: 1, available: 2, users: 1 })
  })
})
