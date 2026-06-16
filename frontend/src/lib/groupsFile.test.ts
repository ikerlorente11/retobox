import { describe, expect, it } from 'vitest'
import { buildGroupsFileContent, parseGroupsFile } from './groupsFile'
import type { WordGroup } from '../types'

const sample: WordGroup[] = [
  { id: 1, name: 'Zona', words: ['Cocina', 'Salón'], created_at: 'x' },
]

describe('groupsFile', () => {
  it('exporta solo {name, words} y hace round-trip', () => {
    const obj = JSON.parse(buildGroupsFileContent(sample))
    expect(obj.groups[0]).toEqual({ name: 'Zona', words: ['Cocina', 'Salón'] })
    expect(parseGroupsFile(buildGroupsFileContent(sample))[0].name).toBe('Zona')
  })

  it('descarta grupos sin nombre y filtra palabras no-string', () => {
    const parsed = parseGroupsFile(
      JSON.stringify([
        { name: 'G', words: ['a', 1, 'b', null] },
        { words: ['x'] },
      ]),
    )
    expect(parsed).toHaveLength(1)
    expect(parsed[0].words).toEqual(['a', 'b'])
  })

  it('lanza con entradas inválidas', () => {
    expect(() => parseGroupsFile('nope')).toThrow()
    expect(() => parseGroupsFile('[]')).toThrow()
  })
})
