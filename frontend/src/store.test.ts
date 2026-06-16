import { describe, expect, it } from 'vitest'
import { useStore } from './store'

// Importar el store ejecuta toda la cadena de inicialización (store -> api ->
// i18n) y los efectos de arranque (tema, idioma en <html>). Si hubiera un ciclo
// de imports o un error en init, este test fallaría al importar -> protege
// contra que la app salga en blanco.
describe('store', () => {
  it('se inicializa con los valores por defecto sin lanzar', () => {
    const s = useStore.getState()
    expect(s.lang).toBe('es')
    expect(s.theme).toBe('dark')
    expect(s.loading).toBe(true)
    expect(s.collections).toEqual([])
    expect(s.activeCollectionId).toBeNull()
  })

  it('setLang actualiza el idioma y <html lang>', () => {
    useStore.getState().setLang('en')
    expect(useStore.getState().lang).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    useStore.getState().setLang('es') // restaura
  })
})
