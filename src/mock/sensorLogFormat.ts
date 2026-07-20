// Legacy-style text serialization for the Kaiju Sensor Grid.
//
// Turns the clean `RadarPing[]` stream into a deliberately old-school, slightly
// inconsistent radar-log text: one line per ping, ISO
// timestamps, and a *minimal* amount of intentional mess so the attribution
// scenario has something to clean up without becoming a data-science slog. The
// mess is applied here, at serialization time, so the underlying `RadarPing`
// data stays clean and independently testable.
//
// The mess is kept to exactly two seeded touches:
//   1. an occasional missing field — the `elev=` token is dropped on ~6% of
//      lines (`rng() < 0.06`);
//   2. one simple deliberate logging quirk — longitude is emitted under the
//      legacy `lon=` label even though the code uses `lng` internally.
// Position noise already lives in the ping data (added by the simulator), so it
// is not re-applied here.
//
// Monster defs are serialized to pretty JSON for the committed attribution

import seedrandom from 'seedrandom'

import type { MonsterDef } from './monsterDefs'
import type { RadarPing } from './sensorLog'

/** Fixed seed for the serialization mess — change to reshuffle dropped fields. */
export const SENSOR_LOG_FORMAT_SEED = 'kaiju-sensor-log-format-v1'

/** Fraction of lines that drop the `elev=` token (the "missing field" mess). */
const DROP_ELEV_PROB = 0.06

/**
 * Serializes a ping stream to the legacy radar-log text: one `\n`-joined line
 * per ping, so `formatLog(pings).split('\n').length === pings.length`. Uses ISO
 * timestamps and applies the minimal seeded mess described above.
 */
export function formatLog(
  pings: readonly RadarPing[],
  seed: string = SENSOR_LOG_FORMAT_SEED,
): string {
  const rng = seedrandom(seed)

  return pings
    .map((p) => {
      const iso = new Date(p.timestamp).toISOString()
      const base = `${iso} lat=${p.lat.toFixed(5)} lon=${p.lng.toFixed(5)}`
      return rng() < DROP_ELEV_PROB
        ? base
        : `${base} elev=${p.elevation.toFixed(1)}`
    })
    .join('\n')
}

/** Pretty-prints a single monster def to JSON (2-space indent, trailing newline). */
export function serializeMonsterDef(def: MonsterDef): string {
  return `${JSON.stringify(def, null, 2)}\n`
}

