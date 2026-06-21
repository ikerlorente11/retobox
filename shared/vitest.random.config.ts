import { defineConfig } from 'vitest/config'

// Config SOLO para los tests estadísticos del aleatorio. Se invoca a demanda con
// `npm run test:random` cuando se cambia la lógica de sorteo (draw.ts / rng.ts).
export default defineConfig({
  test: {
    include: ['**/*.random.test.ts'],
  },
})
