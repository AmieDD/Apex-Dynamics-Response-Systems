/// <reference types="vitest/config" />
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages has no server-side routing: a request for an unknown path
// (e.g. a deep link) returns 404.html instead of index.html. Copying the
// built index.html to 404.html makes Pages serve the SPA shell for any path,
// so client-side routing keeps working on deep links.
function spaFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const index = resolve(outDir, 'index.html')
      if (existsSync(index)) {
        copyFileSync(index, resolve(outDir, '404.html'))
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this project site under /<repo-name>/, so asset and
  // index references must be prefixed with that path in the production build.
  // Vite rewrites index.html `/`-absolute refs automatically; runtime string
  // refs (e.g. the mascot poses) use `import.meta.env.BASE_URL`.
  base: '/Apex-Dynamics-Response-Systems/',
  plugins: [react(), spaFallback()],
  test: {
    // The motion model and dispatch knockback are pure functions (node env);
    // component/hook tests opt into jsdom per-file via a `// @vitest-environment
    // jsdom` docblock. The .tsx pattern covers rendered-component tests.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
