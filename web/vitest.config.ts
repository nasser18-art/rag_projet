import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Les composants sont testés par rendu serveur (renderToString) : pas besoin
// de navigateur ni de DOM simulé, et les effets réseau ne sont pas exécutés.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    reporters: ['default'],
  },
})
