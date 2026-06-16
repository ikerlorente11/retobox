import { describe, expect, it } from 'vitest'
import { buildRetosFileContent, parseRetosFile } from './retosFile'
import type { Challenge } from '../types'

const sample: Challenge[] = [
  {
    id: 1,
    title: 'A',
    description: 'desc',
    required_users: 2,
    involved_users: 4,
    repeatable: true,
    is_used: true,
    created_at: 'x',
    collection_id: 7,
  },
]

describe('buildRetosFileContent', () => {
  it('exporta solo la definición (sin id/is_used/created_at/collection_id)', () => {
    const obj = JSON.parse(buildRetosFileContent(sample))
    expect(obj.app).toBe('retobox')
    expect(obj.challenges[0]).toEqual({
      title: 'A',
      description: 'desc',
      required_users: 2,
      involved_users: 4,
      repeatable: true,
    })
  })
})

describe('parseRetosFile', () => {
  it('round-trip con el contenido exportado', () => {
    const parsed = parseRetosFile(buildRetosFileContent(sample))
    expect(parsed).toHaveLength(1)
    expect(parsed[0].title).toBe('A')
  })

  it('acepta lista pelada y descarta entradas sin título', () => {
    const parsed = parseRetosFile(
      JSON.stringify([
        { title: 'X', required_users: 1 },
        { required_users: 2 },
        { title: '   ' },
      ]),
    )
    expect(parsed.map((p) => p.title)).toEqual(['X'])
  })

  it('normaliza required<1 a 1 e involved<required a null', () => {
    const parsed = parseRetosFile(
      JSON.stringify([{ title: 'Y', required_users: 0, involved_users: 3 }]),
    )
    expect(parsed[0].required_users).toBe(1)
    // involved 3 >= required 1 -> se conserva
    expect(parsed[0].involved_users).toBe(3)
    const p2 = parseRetosFile(
      JSON.stringify([{ title: 'Z', required_users: 5, involved_users: 3 }]),
    )
    expect(p2[0].involved_users).toBeNull()
  })

  it('lanza con JSON inválido, sin lista o sin retos válidos', () => {
    expect(() => parseRetosFile('{ roto')).toThrow()
    expect(() => parseRetosFile('{"foo":1}')).toThrow()
    expect(() => parseRetosFile('[]')).toThrow()
  })
})
