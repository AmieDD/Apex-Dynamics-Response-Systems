// Shape and geography tests for the known-monster definitions. These lock down
// the attribution reference set that feeds the ping simulator: enough distinct
// monsters, every required field present, all tracks anchored in the Puget
// Sound core, and enough sampled steps to yield a meaningful ping stream. Runs
// under the default `node` environment (no DOM needed).

import { describe, expect, it } from 'vitest'

import { MONSTER_DEFS, type MonsterDef } from './monsterDefs'

// Central Seattle bounding box (mirrors the roster geography guard in
// leviathans.test.ts): keeps every monster clustered around the Seattle–
// Bellevue core so an accidental relocation is caught.
const SOUND_BOUNDS = {
  minLng: -122.65,
  maxLng: -122.10,
  minLat: 47.45,
  maxLat: 47.80,
} as const

function inBounds(point: { lng: number; lat: number }): boolean {
  return (
    point.lng >= SOUND_BOUNDS.minLng &&
    point.lng <= SOUND_BOUNDS.maxLng &&
    point.lat >= SOUND_BOUNDS.minLat &&
    point.lat <= SOUND_BOUNDS.maxLat
  )
}

describe('MONSTER_DEFS', () => {
  it('defines at least six known monsters', () => {
    expect(MONSTER_DEFS.length).toBeGreaterThanOrEqual(6)
  })

  it('gives every monster a stable, unique id', () => {
    const ids = MONSTER_DEFS.map((def) => def.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('populates every required field on each definition', () => {
    for (const def of MONSTER_DEFS) {
      expect(typeof def.id).toBe('string')
      expect(def.id.length).toBeGreaterThan(0)
      expect(typeof def.codename).toBe('string')
      expect(def.codename.length).toBeGreaterThan(0)
      expect(typeof def.archetype).toBe('string')
      expect(def.archetype.length).toBeGreaterThan(0)
      expect(typeof def.heightMeters).toBe('number')
      expect(typeof def.weightTons).toBe('number')
      expect(typeof def.speedKmh).toBe('number')
      expect(typeof def.submerged).toBe('boolean')
      expect(typeof def.target).toBe('string')
      expect(def.target.length).toBeGreaterThan(0)
      expect(typeof def.spawnAt).toBe('number')
      expect(typeof def.trackSteps).toBe('number')
      expect(typeof def.spawn.lng).toBe('number')
      expect(typeof def.spawn.lat).toBe('number')
      expect(typeof def.targetPos.lng).toBe('number')
      expect(typeof def.targetPos.lat).toBe('number')
    }
  })

  it('anchors every spawn and target within the Puget Sound bounds', () => {
    for (const def of MONSTER_DEFS) {
      expect(inBounds(def.spawn)).toBe(true)
      expect(inBounds(def.targetPos)).toBe(true)
    }
  })

  it('samples more than 30 pings across the full set', () => {
    const totalSteps = MONSTER_DEFS.reduce(
      (sum: number, def: MonsterDef) => sum + def.trackSteps,
      0,
    )
    expect(totalSteps).toBeGreaterThan(30)
  })
})
