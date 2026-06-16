import { defineConfig } from 'vitest/config'

// Tests unitarios de la lógica PURA del móvil (sin React Native ni nativo).
// La lógica de negocio (validación, sorteo, colecciones, combos, import/export)
// se prueba en el paquete @retobox/shared; aquí solo cubrimos lo propio del
// móvil que no depende de APIs nativas (p. ej. i18n).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
