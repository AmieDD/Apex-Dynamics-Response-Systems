import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { printConsoleEasterEgg } from './easterEgg.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Greet anyone who opens the dev console. Runs client-side, so it works on both
// the local dev server and the deployed site. Swap to `import.meta.env.DEV &&`
// to keep it local-only.
printConsoleEasterEgg()
