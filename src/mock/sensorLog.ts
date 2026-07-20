// Deterministic seeded ping simulator for the Kaiju Sensor Grid.
//
// Samples straight-line positions along each known monster's inbound track and
// merges them into a single, undifferentiated, time-ordered ping stream. Each
// ping carries only timestamp/lat/lng/elevation — no identity — so the log
// mirrors a raw sensor feed that must be attributed after the fact. Positions
// reuse the roster's straight-line lerp (posFromFrac) rather than inventing new
// geometry; elevation is sim-generated per ping (negative when the
// monster is submerged, positive otherwise), which is a net-new field that does
// not touch the `Leviathan` domain model

import seedrandom from 'seedrandom'

import { posFromFrac } from './leviathans'
import type { MonsterDef } from './monsterDefs'

/** Fixed seed for the ping stream — change to regenerate the sensor log. */
export const SENSOR_LOG_SEED = 'kaiju-sensor-grid-v1'

/** A single raw radar return: time and place only, no identity. */
export interface RadarPing {
  /** Epoch-ms observation time. */
  timestamp: number
  /** Latitude (WGS84). */
  lat: number
  /** Longitude (WGS84). */
  lng: number
  /** Meters relative to sea level (negative = submerged). */
  elevation: number
}

/** Returns a value in [min, max) from the supplied PRNG. */
function between(rng: seedrandom.PRNG, min: number, max: number): number {
  return min + rng() * (max - min)
}

/** Light radar jitter (degrees) added to sampled lat/lng. */
const NOISE_DEG = 0.0008

/**
 * Builds the deterministic ping stream from the known-monster definitions.
 * For each def, samples `trackSteps` positions along its `spawn -> targetPos`
 * track (reusing posFromFrac), timestamps them from `spawnAt` at 1 Hz, adds a
 * little radar noise, and assigns an elevation whose sign follows `submerged`.
 * All monsters' pings are merged and sorted by timestamp so the stream
 * interleaves and drops every identity cue. Given the same seed, the output is
 * deep-equal across calls.
 */
export function generatePings(
  defs: readonly MonsterDef[],
  seed: string = SENSOR_LOG_SEED,
): RadarPing[] {
  const rng = seedrandom(seed)
  const pings: RadarPing[] = []

  for (const def of defs) {
    const steps = def.trackSteps
    for (let i = 0; i < steps; i++) {
      const frac = steps > 1 ? i / (steps - 1) : 0
      const pos = posFromFrac(def.spawn, def.targetPos, frac)
      const elevation = def.submerged
        ? between(rng, -40, -5)
        : between(rng, 5, 60)
      pings.push({
        timestamp: def.spawnAt + i * 1000,
        lat: pos.lat + between(rng, -NOISE_DEG, NOISE_DEG),
        lng: pos.lng + between(rng, -NOISE_DEG, NOISE_DEG),
        elevation,
      })
    }
  }

  pings.sort((a, b) => a.timestamp - b.timestamp)
  return pings
}
