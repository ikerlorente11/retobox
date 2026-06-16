import { describe, expect, it } from 'vitest'
import { translate, translateApiError } from './i18n'

describe('translate', () => {
  it('traduce a castellano y a inglés', () => {
    expect(translate('es', 'common.cancel')).toBe('Cancelar')
    expect(translate('en', 'common.cancel')).toBe('Cancel')
  })

  it('interpola parámetros', () => {
    expect(translate('es', 'retos.subtitle', { count: 3, used: 1 })).toBe(
      '3 retos · 1 usados',
    )
    expect(translate('en', 'sorteo.remaining', { total: 5 })).toBe(
      '/ 5 challenges left',
    )
  })

  it('si la clave no existe devuelve la propia clave', () => {
    expect(translate('en', 'clave.que.no.existe')).toBe('clave.que.no.existe')
  })
})

describe('translateApiError', () => {
  it('traduce mensajes conocidos del backend al idioma pedido', () => {
    expect(translateApiError('Colección no encontrada.', 'en')).toBe(
      'Collection not found.',
    )
    expect(translateApiError('No puedes borrar la única colección.', 'en')).toBe(
      "You can't delete the only collection.",
    )
  })

  it('deja intacto un mensaje desconocido', () => {
    expect(translateApiError('algo inesperado', 'en')).toBe('algo inesperado')
  })
})
