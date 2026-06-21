// Abstracción de aleatoriedad inyectable para poder testear de forma determinista.
// `sample` replica el comportamiento de `random.sample` de Python: k elementos
// distintos (sin repetición) elegidos al azar.

export interface Rng {
  choice<T>(items: readonly T[]): T
  // Elige un elemento con probabilidad proporcional a su peso (réplica de
  // random.choices de Python). Si la suma de pesos es <= 0, cae a uniforme.
  weighted<T>(items: readonly T[], weights: readonly number[]): T
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

  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length === 0) {
      throw new Error('weighted() sobre lista vacía')
    }
    let total = 0
    for (const w of weights) {
      total += w > 0 ? w : 0
    }
    if (total <= 0) {
      return this.choice(items) // sin pesos válidos -> uniforme
    }
    let r = Math.random() * total
    for (let i = 0; i < items.length; i++) {
      const w = (weights[i] ?? 0) > 0 ? (weights[i] as number) : 0
      r -= w
      if (r < 0) {
        return items[i] as T
      }
    }
    return items[items.length - 1] as T // borde por redondeo
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
