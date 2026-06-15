/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this project site under /<repo-name>/, so asset and
  // index references must be prefixed with that path in the production build.
  // Vite rewrites index.html `/`-absolute refs automatically; runtime string
  // refs (e.g. the mascot poses) use `import.meta.env.BASE_URL`.
  base: '/Apex-Dynamics-Response-Systems/',
  plugins: [react()],
  test: {
    // The motion model and dispatch knockback are pure functions (node env);
    // component/hook tests opt into jsdom per-file via a `// @vitest-environment
    // jsdom` docblock. The .tsx pattern covers rendered-component tests.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
