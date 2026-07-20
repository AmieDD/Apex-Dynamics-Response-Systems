// Determinism and shape tests for the seeded ping simulator. These lock down
// the raw sensor stream that the attribution scenario consumes: reproducible
// output per seed, enough pings to be meaningful, a strictly time-ordered
// stream, and the deliberate absence of any identity fields (each ping is just
// timestamp/lat/lng/elevation). Elevation sign is asserted to follow the
// submerged/surfaced split. Runs under the default `node` environment (no DOM
// needed).

import { describe, expect, it } from 'vitest'

import { MONSTER_DEFS } from './monsterDefs'
import { SENSOR_LOG_SEED, generatePings, type RadarPing } from './sensorLog'

const PING_KEYS = ['timestamp', 'lat', 'lng', 'elevation'] as const

describe('generatePings', () => {
  it('is deterministic for the same seed', () => {
    const a = generatePings(MONSTER_DEFS, 'fixed-seed')
    const b = generatePings(MONSTER_DEFS, 'fixed-seed')
    expect(a).toEqual(b)
  })

  it('diverges for a different seed', () => {
    const a = generatePings(MONSTER_DEFS, 'seed-a')
    const b = generatePings(MONSTER_DEFS, 'seed-b')
    expect(a).not.toEqual(b)
  })

  it('emits more than 30 pings from the known-monster set', () => {
    const pings = generatePings(MONSTER_DEFS)
    expect(pings.length).toBeGreaterThan(30)
  })

  it('produces a monotonically non-decreasing timestamp stream', () => {
    const pings = generatePings(MONSTER_DEFS, SENSOR_LOG_SEED)
    for (let i = 1; i < pings.length; i++) {
      expect(pings[i].timestamp).toBeGreaterThanOrEqual(pings[i - 1].timestamp)
    }
  })

  it('carries exactly the four ping fields and no identity cues', () => {
    const pings = generatePings(MONSTER_DEFS)
    for (const ping of pings) {
      const keys = Object.keys(ping)
      expect(keys).toHaveLength(4)
      expect(new Set(keys)).toEqual(new Set(PING_KEYS))
    }
  })

  it('assigns elevation sign matching the submerged/surfaced split', () => {
    const pings = generatePings(MONSTER_DEFS)
    const inSubmergedBand = (ping: RadarPing): boolean =>
      ping.elevation >= -40 && ping.elevation <= -5
    const inSurfacedBand = (ping: RadarPing): boolean =>
      ping.elevation >= 5 && ping.elevation <= 60
    for (const ping of pings) {
      expect(inSubmergedBand(ping) || inSurfacedBand(ping)).toBe(true)
    }
  })
})
