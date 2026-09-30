// Builds Scenario Studio sensor overlay for the command map.
//
// Usage:
//   npm run generate:sim-overlay -- <bundle.zip | extracted-bundle-folder>
//       Reads only manifest.json and the two public tracker inputs, verifies
//       them against the manifest, and writes data/sim-scenario/* plus
//       src/mock/simOverlay.json.
//   npm run lint:sim-overlay
//       Check-only: rebuilds the overlay from the committed sources and fails
//       if anything is missing or stale. Never writes.

import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildArtifacts, check, readBundle, writeArtifacts } from './simBundle'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)

try {
  if (args.includes('--check')) {
    const problems = check(repoRoot)
    if (problems.length > 0) {
      console.error(`sim-overlay check FAILED (${problems.length} issue(s)):`)
      for (const problem of problems) console.error(`  - ${problem}`)
      console.error('Regenerate with `npm run generate:sim-overlay -- <bundle.zip | folder>`.')
      process.exit(1)
    }
    console.log('sim-overlay check passed (sources and overlay are current).')
  } else {
    const [input, ...extra] = args
    if (!input) {
      console.log('Usage: npm run generate:sim-overlay -- <bundle.zip | extracted-bundle-folder>')
      console.log('')
      console.log('A bundle is only needed to import a new Scenario Studio scenario.')
      console.log('The committed overlay already powers the map; nothing needs regenerating.')
      console.log('To verify it is current, run `npm run lint:sim-overlay`.')
      process.exit(0)
    }
    if (extra.length > 0) {
      console.error('Usage: npm run generate:sim-overlay -- <bundle.zip | extracted-bundle-folder>')
      process.exit(2)
    }
    const artifacts = buildArtifacts(readBundle(resolve(input)))
    writeArtifacts(repoRoot, artifacts)
    for (const path of artifacts.keys()) console.log(`wrote ${path}`)
  }
} catch (error) {
  console.error(`sim-overlay: ${(error as Error).message}`)
  process.exit(1)
}
