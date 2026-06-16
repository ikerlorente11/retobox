import { describe, expect, it } from 'vitest'
import { initials, readableText } from './colors'

describe('initials', () => {
  it('una palabra -> 2 primeras letras', () => {
    expect(initials('Lucía')).toBe('LU')
  })
  it('dos palabras -> iniciales', () => {
    expect(initials('Ana Belén')).toBe('AB')
  })
  it('vacío -> ?', () => {
    expect(initials('   ')).toBe('?')
  })
})

describe('readableText', () => {
  it('texto oscuro sobre color claro', () => {
    expect(readableText('#eab308')).toBe('#1c1033') // ámbar (claro)
  })
  it('texto blanco sobre color oscuro', () => {
    expect(readableText('#3b82f6')).toBe('#ffffff') // azul (oscuro)
  })
  it('hex inválido -> blanco', () => {
    expect(readableText('#xyz')).toBe('#fff')
  })
})
