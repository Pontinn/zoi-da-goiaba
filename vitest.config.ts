import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Aliases identicos aos do electron.vite.config.ts para que o nucleo puro seja
// testado exatamente como e importado pelo app.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    reporters: ['default']
  }
})
