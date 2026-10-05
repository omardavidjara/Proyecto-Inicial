import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      'server-only': fileURLToPath(new URL('./__tests__/helpers/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
  },
})
