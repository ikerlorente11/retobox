// Abstracción de aleatoriedad inyectable para poder testear de forma determinista.
// `sample` replica el comportamiento de `random.sample` de Python: k elementos
// distintos (sin repetición) elegidos al azar.

export interface Rng {
  choice<T>(items: readonly T[]): T
  sample<T>(items: readonly T[], count: number): T[]
}

export const defaultRng: Rng = {
  choice<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('choice() sobre lista vacía')
    }
    const index = Math.floor(Math.random() * items.length)
    return items[index] as T
  },

  sample<T>(items: readonly T[], count: number): T[] {
    if (count > items.length) {
      throw new Error('sample mayor que la población')
    }
    // Fisher–Yates parcial: baraja solo los primeros `count` elementos.
    const pool = [...items]
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(Math.random() * (pool.length - i))
      const tmp = pool[i] as T
      pool[i] = pool[j] as T
      pool[j] = tmp
    }
    return pool.slice(0, count)
  },
}
