// RNG determinista para tests: `choice` siempre devuelve el primer elemento y
// `sample` los primeros `count`. Hace reproducibles las aserciones sobre el sorteo.

import type { Rng } from '../src/rng'

export const firstRng: Rng = {
  choice<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('choice() sobre lista vacía')
    }
    return items[0] as T
  },
  sample<T>(items: readonly T[], count: number): T[] {
    if (count > items.length) {
      throw new Error('sample mayor que la población')
    }
    return items.slice(0, count)
  },
}
