import { describe, expect, it } from 'vitest'

import { LAST_STAND_CITIES } from './lastStandCities'

describe('last-stand city geography', () => {
  /** Puget Sound cities the scenario is allowed to dramatize. */
  const PUGET_SOUND_CITIES = new Set([
    'SEATTLE',
    'BELLEVUE',
    'TACOMA',
    'EVERETT',
    'BREMERTON',
    'OLYMPIA',
  ])

  it('dramatizes exactly two cities, one per field side', () => {
    expect(LAST_STAND_CITIES).toHaveLength(2)
    expect(LAST_STAND_CITIES.map((c) => c.side)).toEqual(['left', 'right'])
  })

  it('names only Puget Sound cities', () => {
    for (const city of LAST_STAND_CITIES) {
      expect(PUGET_SOUND_CITIES.has(city.name)).toBe(true)
    }
  })

  it('has positive mocked populations', () => {
    for (const city of LAST_STAND_CITIES) {
      expect(city.population).toBeGreaterThan(0)
    }
  })
})
