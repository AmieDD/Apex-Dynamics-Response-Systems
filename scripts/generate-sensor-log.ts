// Generate the committed Kaiju Sensor Grid artifacts from the shared TS core.
//
// This is the single build-time entry point that turns the seeded simulator
// modules under src/mock/ into the files attendees open for the workshop:
//   - data/sensor-grid.txt            the raw, identity-stripped radar log
//   - data/monsters/<codename>.json   one known-monster attribution reference
//
// It runs natively via `node scripts/generate-sensor-log.ts` — Node's built-in
// TypeScript type stripping executes the .ts file directly, so there is NO new
// dependency and NO ts-node/tsx/vite-node. The generator and every module it
// imports must therefore stay free of `enum`/`namespace` (already true).
//
// Determinism:both PRNG stages are pinned to explicit fixed seeds
// (SENSOR_LOG_SEED, SENSOR_LOG_FORMAT_SEED) so repeated runs are byte-identical.
// Nothing here reads the clock or randomizes.
//
// Usage:
//   npm run generate:sensor-log   regenerate data/sensor-grid.txt + data/monsters/*.json
//   npm run lint:sensor-log       check-only: fail if committed artifacts have
//                                 drifted from the current source (no writes)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MONSTER_DEFS } from '../src/mock/monsterDefs';
import { generatePings, SENSOR_LOG_SEED } from '../src/mock/sensorLog';
import {
  formatLog,
  serializeMonsterDef,
  SENSOR_LOG_FORMAT_SEED,
} from '../src/mock/sensorLogFormat';

const checkMode = process.argv.includes('--check');

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(repoRoot, 'data');
const monstersDir = join(dataDir, 'monsters');

// Turn a codename into a safe lowercase filename stem (e.g. "Gorathos" ->
// "gorathos"). Non-alphanumeric runs collapse to a single hyphen so any future
// multi-word codename still yields a stable, portable path.
function codenameToStem(codename: string): string {
  return codename
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Compute the full desired output set in memory. Both modes derive from this
// so `--check` compares against exactly what a write would produce.
function buildArtifacts() {
  const pings = generatePings(MONSTER_DEFS, SENSOR_LOG_SEED);
  const log = formatLog(pings, SENSOR_LOG_FORMAT_SEED);

  const artifacts = [
    { path: join(dataDir, 'sensor-grid.txt'), label: 'data/sensor-grid.txt', content: log },
  ];

  // Guard the codename -> filename mapping: an empty or colliding stem would
  // otherwise silently produce a garbage path or clobber another monster's
  // reference file (and --check could not detect it). Fail loudly instead.
  const seenStems = new Set<string>();
  for (const def of MONSTER_DEFS) {
    const stem = codenameToStem(def.codename);
    if (stem === '') {
      throw new Error(
        `Codename "${def.codename}" (id ${def.id}) yields an empty filename stem.`,
      );
    }
    if (seenStems.has(stem)) {
      throw new Error(
        `Codename stem "${stem}" is not unique (collision at id ${def.id}); rename to disambiguate.`,
      );
    }
    seenStems.add(stem);
    artifacts.push({
      path: join(monstersDir, `${stem}.json`),
      label: `data/monsters/${stem}.json`,
      content: serializeMonsterDef(def),
    });
  }

  return { artifacts, pingCount: pings.length };
}

const { artifacts, pingCount } = buildArtifacts();

// --- check mode -----------------------------------------------------------
if (checkMode) {
  const problems = [];
  for (const artifact of artifacts) {
    let current;
    try {
      current = readFileSync(artifact.path, 'utf8');
    } catch {
      problems.push(`${artifact.label} is missing (run \`npm run generate:sensor-log\`)`);
      continue;
    }
    if (current !== artifact.content) {
      problems.push(`${artifact.label} is out of date (run \`npm run generate:sensor-log\`)`);
    }
  }
  if (problems.length > 0) {
    console.error(`sensor-log drift check FAILED (${problems.length} issue(s)):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(
    `sensor-log drift check passed (${artifacts.length} files, ${pingCount} pings).`,
  );
  process.exit(0);
}

// --- write mode -----------------------------------------------------------
mkdirSync(monstersDir, { recursive: true });
for (const artifact of artifacts) {
  writeFileSync(artifact.path, artifact.content, 'utf8');
  console.log(`wrote ${artifact.label}`);
}
console.log(
  `Done: ${artifacts.length} file(s) written (${pingCount} pings across ${MONSTER_DEFS.length} monsters).`,
);
