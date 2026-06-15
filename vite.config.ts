/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // The motion model and dispatch knockback are pure functions (node env);
    // component/hook tests opt into jsdom per-file via a `// @vitest-environment
    // jsdom` docblock. The .tsx pattern covers rendered-component tests.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
