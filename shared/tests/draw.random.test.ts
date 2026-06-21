// Tests ESTADÍSTICOS del aleatorio del sorteo (lógica compartida que usa la app
// MÓVIL offline). Verifican que la ponderación por draw_count reparte las cartas
// casi por igual, que salen TODAS en pocas tiradas, que el ORDEN es aleatorio y
// que sesiones largas no rompen el sorteo (blindaje contra underflow de pesos).
//
// Son lentos y NO deterministas por diseño (usan el RNG real), así que NO se
// ejecutan en la suite normal: córrelos con `npm run test:random` (o
// `vitest run -c vitest.random.config.ts`) cuando cambies la lógica de sorteo
// (src/draw.ts, src/rng.ts). Espejo de backend/tests/test_random_quality.py.

import { describe, expect, it } from 'vitest'

import { InMemoryRepository } from '../src/index'

async function withRepeatables(n: number): Promise<InMemoryRepository> {
  const repo = new InMemoryRepository()
  for (let i = 0; i < n; i++) {
    await repo.createChallenge({ title: `C${i}`, required_users: 1, repeatable: true })
  }
  return repo
}

describe('aleatorio (anti-repetición por decaimiento)', () => {
  it('reparte casi uniforme y salen TODAS (15 repetibles × 300)', async () => {
    const n = 15
    const draws = 300
    const repo = await withRepeatables(n)
    const counts = new Map<number, number>()
    for (let i = 0; i < draws; i++) {
      const { challenge } = await repo.draw({ mode: 'random' })
      counts.set(challenge.id, (counts.get(challenge.id) ?? 0) + 1)
    }
    expect(counts.size).toBe(n) // salen todas

    const values = [...counts.values()]
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((a, c) => a + (c - mean) ** 2, 0) / values.length
    const cv = Math.sqrt(variance) / mean
    // Uniforme puro daría CV ~0.25; el decaimiento lo deja muy por debajo.
    expect(cv).toBeLessThan(0.15)
  })

  it('ve todas las cartas en pocas tiradas (cobertura)', async () => {
    const n = 15
    const repo = await withRepeatables(n)
    const seen = new Set<number>()
    let coverage = n * 3
    for (let i = 1; i <= n * 3; i++) {
      const { challenge } = await repo.draw({ mode: 'random' })
      seen.add(challenge.id)
      if (seen.size === n) {
        coverage = i
        break
      }
    }
    expect(coverage).toBeLessThanOrEqual(n * 2)
  })

  it('el ORDEN es aleatorio: 5 sesiones producen órdenes distintos', async () => {
    const orders = new Set<string>()
    for (let run = 0; run < 5; run++) {
      const n = 15
      const repo = await withRepeatables(n)
      const seen = new Set<number>()
      const order: number[] = []
      for (let i = 0; i < n * 2 && seen.size < n; i++) {
        const { challenge } = await repo.draw({ mode: 'random' })
        if (!seen.has(challenge.id)) {
          seen.add(challenge.id)
          order.push(challenge.id)
        }
      }
      orders.add(order.join(','))
    }
    expect(orders.size).toBeGreaterThanOrEqual(4)
  })

  it('sesión larga sobre pocas repetibles no rompe (blindaje underflow)', async () => {
    const n = 5
    const repo = await withRepeatables(n)
    for (let i = 0; i < 500; i++) {
      const { challenge } = await repo.draw({ mode: 'random' })
      expect(challenge.id).toBeGreaterThan(0)
    }
    expect((await repo.getStats()).used).toBe(n)
  })
})
