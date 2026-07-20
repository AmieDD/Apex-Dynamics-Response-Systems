// Serialization tests for the legacy-style sensor log. These lock down the
// three properties the attribution scenario relies on: exactly one line per
// ping (no accidental wrapping/merging), a *bounded* amount of deliberate mess
// (5-15% of lines missing a field) so the exercise is realistic but not a
// data-science slog, deterministic output for a fixed seed, and round-trippable
// JSON for the committed monster-def reference files. Runs under the default
// `node` environment (no DOM needed).

import { describe, expect, it } from 'vitest'

import { MONSTER_DEFS } from './monsterDefs'
import type { MonsterDef } from './monsterDefs'
import { generatePings } from './sensorLog'
import type { RadarPing } from './sensorLog'
import {
  formatLog,
  serializeMonsterDef,
} from './sensorLogFormat'

/** Pinned seed whose dropped-field ratio lands deterministically in-band. */
const MESS_SEED = 'mess-ratio-fixture-1'

const pings: readonly RadarPing[] = generatePings(MONSTER_DEFS)

describe('formatLog', () => {
  it('emits exactly one line per ping', () => {
    const out = formatLog(pings)
    expect(out.split('\n')).toHaveLength(pings.length)
  })

  it('drops the elev field on 5-15% of lines for a fixed seed', () => {
    const lines = formatLog(pings, MESS_SEED).split('\n')
    const missing = lines.filter((line) => !line.includes('elev=')).length
    const ratio = missing / lines.length
    expect(ratio).toBeGreaterThanOrEqual(0.05)
    expect(ratio).toBeLessThanOrEqual(0.15)
  })

  it('is deterministic for the same seed', () => {
    const a = formatLog(pings, MESS_SEED)
    const b = formatLog(pings, MESS_SEED)
    expect(a).toEqual(b)
  })

  it('emits the legacy lon= label and never a lng= label', () => {
    const out = formatLog(pings)
    expect(out).toContain(' lon=')
    expect(out).not.toContain(' lng=')
  })
})

describe('serializeMonsterDef', () => {
  it('round-trips a single def through JSON.parse', () => {
    const [def] = MONSTER_DEFS
    const parsed = JSON.parse(serializeMonsterDef(def)) as MonsterDef
    expect(parsed).toEqual(def)
  })
})
