// Dev-console easter egg. Prints a styled banner, socials, and the tech stack
// for any curious nerd who pops open the browser console.
//
// This runs purely client-side, so it works the same on the local dev server
// (`npm run dev`) and on the deployed GitHub Pages site — there's no server
// involved, the browser just runs the bundled JS either way. To make it
// dev-only instead, gate the call in main.tsx behind `import.meta.env.DEV`.

// Half-block figlet banner: "APEX DYNAMICS". String.raw keeps the backslashes
// and block glyphs intact regardless of escaping.
const BANNER = String.raw`
█▀█ █▀█ █▀▀ ▀▄▀   █▀▄ █▄█ █▄█ █▀█ █▀▄▀█ █ █▀▀ █▀▀
█▀█ █▀▀ ██▄ █░█   █▄▀ ░█░ █░█ █▀█ █░▀░█ █ █▄▄ ▄██
`

// Socials shown in the console, keyed by label for aligned output.
const SOCIALS: ReadonlyArray<readonly [label: string, url: string]> = [
  ['GitHub', 'https://github.com/AmieDD'],
  ['Twitter/X', 'https://x.com/amiedoubled'],
  ['Instagram', 'https://www.instagram.com/amiedoubled'],
  ['LinkedIn', 'https://www.linkedin.com/in/amiedd/'],
  ['All Links', 'https://amiedd.tech/'],
]

const TECH_STACK = 'Vite • React • TypeScript • Tailwind CSS • MapLibre GL • GitHub Pages'

// Guard flag so hot-module reloads and React StrictMode re-invocations don't
// reprint the banner on every refresh during development.
const PRINTED_FLAG = '__apexConsoleEggPrinted'

/** Print the styled dev-console easter egg. Safe to call more than once: it
 *  no-ops after the first run and bails out in non-browser environments. */
export function printConsoleEasterEgg(): void {
  if (typeof window === 'undefined' || typeof console === 'undefined') return

  const flags = window as unknown as Record<string, boolean>
  if (flags[PRINTED_FLAG]) return
  flags[PRINTED_FLAG] = true

  const accent = '#a78bfa' // brand violet (--accent)
  const purple = '#863bff' // brand purple hairline (--topbar-border)
  const muted = '#8b949e' // telemetry text (--text-muted)

  console.log(`%c${BANNER}`, `color:${purple};font-weight:700;`)

  console.log(
    '%cIncoming transmission, fellow nerd. %cYou found the command-center console.',
    `color:${accent};font-weight:700;`,
    `color:${muted};`,
  )

  console.log('%cSocials', `color:${accent};font-weight:700;font-size:13px;`)
  for (const [label, url] of SOCIALS) {
    console.log(`%c${label.padEnd(10)}%c${url}`, `color:${muted};`, `color:${accent};`)
  }

  console.log('%cTech Stack', `color:${accent};font-weight:700;font-size:13px;`)
  console.log(`%c${TECH_STACK}`, `color:${muted};`)
}
