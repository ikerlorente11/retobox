import { configDefaults, defineConfig } from 'vitest/config'

// Config por defecto de la suite compartida. Excluye los tests ESTADÍSTICOS del
// aleatorio (*.random.test.ts): son lentos y no deterministas, así que solo se
// corren a demanda con `npm run test:random` (vitest.random.config.ts) cuando se
// cambia la lógica de sorteo.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/*.random.test.ts'],
  },
})
