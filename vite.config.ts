/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// En desarrollo, /api/* va al servicio de la v1.3 (`npm run api`, puerto 8787).
const proxyApi = { '/api': 'http://127.0.0.1:8787' }

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: proxyApi,
  },
  preview: {
    proxy: proxyApi,
  },
  build: {
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
