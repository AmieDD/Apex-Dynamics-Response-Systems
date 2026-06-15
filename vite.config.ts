/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // The motion model and dispatch knockback are pure functions; no DOM.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
