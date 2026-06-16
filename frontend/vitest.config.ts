import { defineConfig } from 'vitest/config'

// Tests unitarios del frontend (lógica pura: i18n, parsers de import/export…).
// jsdom porque algunos módulos tocan document/localStorage al cargar (store).
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
