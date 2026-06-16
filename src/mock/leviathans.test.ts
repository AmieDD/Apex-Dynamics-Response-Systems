// Unit tests for the inbound-track motion model and dispatch knockback.
//
// These functions are pure and drive the live map: remaining range, status
// band, marker position, landfall cycles, and dispatch repel decay. Locking
// them down here guards the side-panel readouts and dispatch feedback that
// derive from them.

import { describe, expect, it } from 'vitest'

import { THREAT_LEVELS, type ThreatLevel } from './severity'
import {
  CLOSURE_RATE,
  REPEL_DECAY_PER_TICK,
  REPEL_KNOCKBACK_FRAC,
  REPEL_KNOCKBACK_MAX,
  ANCHOR,
  createRoster,
  cycleAt,
  deriveAdvance,
  etaToLandfall,
  formatEta,
  fracAt,
  posFromFrac,
  rangeFromFrac,
  staticFracFor,
  statusFromRange,
  tickLeviathans,
  type AdvanceTrack,
} from './leviathans'

// A 200 km track shedding 5 km/s (speed 100 · CLOSURE_RATE 0.05) completes one
// landfall cycle every 40 sim-seconds — convenient round numbers for the
// motion assertions below.
const TRACK = { speed: 100, startRange: 200 } as const

describe('tuning constants', () => {
  it('keeps closure rate pinned at the documented value', () => {
    expect(CLOSURE_RATE).toBe(0.05)
  })

  it('orders knockback so one dispatch cannot exceed the cap', () => {
    expect(REPEL_KNOCKBACK_FRAC).toBeGreaterThan(0)
    expect(REPEL_KNOCKBACK_MAX).toBeGreaterThan(REPEL_KNOCKBACK_FRAC)
    expect(REPEL_DECAY_PER_TICK).toBeGreaterThan(0)
  })
})

describe('fracAt', () => {
  it('starts at the spawn point (0) when no time has passed', () => {
    expect(fracAt(TRACK, 0)).toBe(0)
  })

  it('reaches the track midpoint halfway through a cycle', () => {
    expect(fracAt(TRACK, 20)).toBeCloseTo(0.5, 10)
  })

  it('wraps back to the spawn point after a full cycle', () => {
    expect(fracAt(TRACK, 40)).toBeCloseTo(0, 10)
  })

  it('always stays within [0, 1)', () => {
    for (let t = 0; t <= 200; t += 7) {
      const frac = fracAt(TRACK, t)
      expect(frac).toBeGreaterThanOrEqual(0)
      expect(frac).toBeLessThan(1)
    }
  })
})

describe('cycleAt', () => {
  it('reports no completed cycles before the first landfall', () => {
    expect(cycleAt(TRACK, 0)).toBe(0)
    expect(cycleAt(TRACK, 39.9)).toBe(0)
  })

  it('counts one cycle at exactly one track length', () => {
    expect(cycleAt(TRACK, 40)).toBe(1)
  })

  it('increments once per completed track length', () => {
    expect(cycleAt(TRACK, 80)).toBe(2)
    expect(cycleAt(TRACK, 100)).toBe(2)
  })

  it('combines with fracAt to equal total progress', () => {
    const t = 50
    const total = (TRACK.speed * CLOSURE_RATE * t) / TRACK.startRange
    expect(cycleAt(TRACK, t) + fracAt(TRACK, t)).toBeCloseTo(total, 10)
  })
})

describe('rangeFromFrac', () => {
  it('is the full start range at the spawn point', () => {
    expect(rangeFromFrac(200, 0)).toBe(200)
  })

  it('is zero at landfall', () => {
    expect(rangeFromFrac(200, 1)).toBe(0)
  })

  it('falls linearly with progress', () => {
    expect(rangeFromFrac(200, 0.5)).toBe(100)
    expect(rangeFromFrac(91, 0.25)).toBeCloseTo(68.25, 10)
  })
})

describe('posFromFrac', () => {
  const from = { lng: -122.6, lat: 37.8 }
  const to = { lng: -122.4, lat: 37.9 }

  it('returns the spawn point at frac 0', () => {
    expect(posFromFrac(from, to, 0)).toEqual(from)
  })

  it('returns the landfall point at frac 1', () => {
    expect(posFromFrac(from, to, 1)).toEqual(to)
  })

  it('interpolates the midpoint at frac 0.5', () => {
    const mid = posFromFrac(from, to, 0.5)
    expect(mid.lng).toBeCloseTo(-122.5, 10)
    expect(mid.lat).toBeCloseTo(37.85, 10)
  })
})

describe('statusFromRange', () => {
  it('flags landfall inside the landfall band (< 25 km)', () => {
    expect(statusFromRange(0)).toBe('LANDFALL')
    expect(statusFromRange(24.9)).toBe('LANDFALL')
  })

  it('flags surfaced in the mid band [25, 70) km', () => {
    expect(statusFromRange(25)).toBe('SURFACED')
    expect(statusFromRange(69.9)).toBe('SURFACED')
  })

  it('flags inbound beyond the surfaced band (>= 70 km)', () => {
    expect(statusFromRange(70)).toBe('INBOUND')
    expect(statusFromRange(200)).toBe('INBOUND')
  })
})

describe('staticFracFor', () => {
  it('places higher threats closer to landfall', () => {
    const expected: Record<ThreatLevel, number> = {
      Dormant: 0.12,
      Stirring: 0.3,
      Elevated: 0.5,
      Critical: 0.7,
      Cataclysm: 0.92,
    }
    for (const threat of THREAT_LEVELS) {
      expect(staticFracFor(threat)).toBe(expected[threat])
    }
  })

  it('increases monotonically with threat rank', () => {
    const fracs = THREAT_LEVELS.map((threat) => staticFracFor(threat))
    for (let i = 1; i < fracs.length; i += 1) {
      expect(fracs[i]).toBeGreaterThan(fracs[i - 1])
    }
  })
})

describe('createRoster', () => {
  it('is deterministic for a given seed', () => {
    expect(createRoster('seed-a')).toEqual(createRoster('seed-a'))
  })

  it('varies the seeded stats across different seeds', () => {
    expect(createRoster('seed-a')).not.toEqual(createRoster('seed-b'))
  })

  it('spawns the full four-leviathan roster with stable ids', () => {
    const roster = createRoster()
    expect(roster).toHaveLength(4)
    expect(roster.map((lev) => lev.id)).toEqual([
      'lev-1',
      'lev-2',
      'lev-3',
      'lev-4',
    ])
  })

  it('starts every leviathan with no dispatch knockback', () => {
    for (const lev of createRoster()) {
      expect(lev.repel).toBe(0)
    }
  })
})

describe('tickLeviathans', () => {
  it('is deterministic for a given seed', () => {
    const roster = createRoster()
    expect(tickLeviathans(roster, 'tick-seed')).toEqual(
      tickLeviathans(roster, 'tick-seed'),
    )
  })

  it('sheds one decay step of dispatch knockback per tick', () => {
    const charged = createRoster().map((lev, i) =>
      i === 0 ? { ...lev, repel: 0.18 } : lev,
    )
    const ticked = tickLeviathans(charged, 'tick-seed')
    expect(ticked[0].repel).toBeCloseTo(0.18 - REPEL_DECAY_PER_TICK, 5)
  })

  it('never lets knockback fall below zero', () => {
    const nearlyRecovered = createRoster().map((lev, i) =>
      i === 0 ? { ...lev, repel: 0.02 } : lev,
    )
    const ticked = tickLeviathans(nearlyRecovered, 'tick-seed')
    expect(ticked[0].repel).toBe(0)
    expect(ticked[1].repel).toBe(0)
  })

  it('counts down containment hit points', () => {
    const roster = createRoster()
    const ticked = tickLeviathans(roster, 'tick-seed')
    for (let i = 0; i < roster.length; i += 1) {
      expect(ticked[i].hp).toBeLessThan(roster[i].hp)
      expect(ticked[i].hp).toBeGreaterThanOrEqual(0)
    }
  })

  it('keeps speed within the valid band', () => {
    const ticked = tickLeviathans(createRoster(), 'tick-seed')
    for (const lev of ticked) {
      expect(lev.speed).toBeGreaterThanOrEqual(0)
      expect(lev.speed).toBeLessThanOrEqual(120)
    }
  })

  it('leaves the map-owned track fields untouched', () => {
    const roster = createRoster()
    const ticked = tickLeviathans(roster, 'tick-seed')
    for (let i = 0; i < roster.length; i += 1) {
      expect(ticked[i].from).toEqual(roster[i].from)
      expect(ticked[i].to).toEqual(roster[i].to)
      expect(ticked[i].startRange).toBe(roster[i].startRange)
      expect(ticked[i].range).toBe(roster[i].range)
      expect(ticked[i].lng).toBe(roster[i].lng)
      expect(ticked[i].lat).toBe(roster[i].lat)
    }
  })
})

describe('map readout integration', () => {
  it('derives a linear remaining range from track progress', () => {
    // Halfway along the 200 km track, the roster Range readout should show 100.
    const frac = fracAt(TRACK, 20)
    expect(rangeFromFrac(TRACK.startRange, frac)).toBeCloseTo(100, 6)
  })

  it('crosses from inbound to landfall as the track advances', () => {
    const early = rangeFromFrac(TRACK.startRange, fracAt(TRACK, 1))
    const late = rangeFromFrac(TRACK.startRange, fracAt(TRACK, 39))
    expect(statusFromRange(early)).toBe('INBOUND')
    expect(statusFromRange(late)).toBe('LANDFALL')
  })
})

describe('etaToLandfall', () => {
  it('closes the remaining range at speed times the closure rate', () => {
    // 200 km shedding 5 km/s (speed 100 · 0.05) lands in 40 sim-seconds.
    expect(etaToLandfall(200, 100)).toBeCloseTo(40, 10)
  })

  it('halves the ETA when the range is halved', () => {
    expect(etaToLandfall(100, 100)).toBeCloseTo(etaToLandfall(200, 100) / 2, 10)
  })

  it('reaches landfall immediately at zero range', () => {
    expect(etaToLandfall(0, 100)).toBe(0)
  })

  it('reports a held target (Infinity) when it is not closing', () => {
    expect(etaToLandfall(200, 0)).toBe(Infinity)
  })
})

describe('formatEta', () => {
  it('labels a non-closing target as HOLD', () => {
    expect(formatEta(Infinity)).toBe('HOLD')
  })

  it('shows bare seconds under a minute', () => {
    expect(formatEta(48)).toBe('48s')
  })

  it('rounds to the nearest whole second', () => {
    expect(formatEta(47.4)).toBe('47s')
    expect(formatEta(47.6)).toBe('48s')
  })

  it('shows minutes and zero-padded seconds at a minute or more', () => {
    expect(formatEta(60)).toBe('1m 00s')
    expect(formatEta(137)).toBe('2m 17s')
  })

  it('never emits a negative readout', () => {
    expect(formatEta(-5)).toBe('0s')
  })
})

describe('deriveAdvance', () => {
  // A 200 km track running due east, shedding 5 km/s (speed 100 · 0.05): one
  // landfall cycle every 40 sim-seconds, midpoint at 20.
  const TRACK: AdvanceTrack = {
    from: { lng: 0, lat: 0 },
    to: { lng: 10, lat: 0 },
    startRange: 200,
    speed: 100,
  }

  it('resolves position, range, status, and ETA from the live advance', () => {
    const a = deriveAdvance(TRACK, 'Critical', 0, 100, 20, false)

    expect(a.frac).toBeCloseTo(0.5, 10)
    expect(a.pos.lng).toBeCloseTo(5, 10)
    expect(a.pos.lat).toBeCloseTo(0, 10)
    expect(a.rangeKm).toBeCloseTo(100, 10)
    expect(a.status).toBe('INBOUND')
    expect(a.eta).toBe('20s')
  })

  it('subtracts dispatch knockback from the natural advance', () => {
    const base = deriveAdvance(TRACK, 'Critical', 0, 100, 20, false)
    const repelled = deriveAdvance(TRACK, 'Critical', 0.2, 100, 20, false)

    expect(repelled.frac).toBeCloseTo(base.frac - 0.2, 10)
    expect(repelled.rangeKm).toBeGreaterThan(base.rangeKm)
  })

  it('clamps the advance at spawn when knockback exceeds progress', () => {
    const a = deriveAdvance(TRACK, 'Critical', 5, 100, 20, false)

    expect(a.frac).toBe(0)
    expect(a.pos).toEqual(TRACK.from)
    expect(a.rangeKm).toBe(TRACK.startRange)
  })

  it('holds a static threat snapshot under reduced motion', () => {
    // Reduced motion ignores both sim time and knockback.
    const a = deriveAdvance(TRACK, 'Critical', 0.9, 100, 999, true)

    expect(a.frac).toBe(staticFracFor('Critical'))
    expect(a.rangeKm).toBeCloseTo(rangeFromFrac(200, staticFracFor('Critical')), 10)
  })

  it('uses the live speed for the ETA, not the frozen track pace', () => {
    // Half the live speed → twice the ETA, even though the track paces at 100.
    const fast = deriveAdvance(TRACK, 'Critical', 0, 100, 20, false)
    const slow = deriveAdvance(TRACK, 'Critical', 0, 50, 20, false)

    expect(fast.eta).toBe('20s')
    expect(slow.eta).toBe('40s')
  })

  it('crosses into the landfall band as the advance closes', () => {
    const early = deriveAdvance(TRACK, 'Critical', 0, 100, 1, false)
    const late = deriveAdvance(TRACK, 'Critical', 0, 100, 39, false)

    expect(early.status).toBe('INBOUND')
    expect(late.status).toBe('LANDFALL')
  })
})

describe('roster geography', () => {
  // Central Seattle bounding box (tight): keeps the roster clustered around the
  // Seattle–Bellevue core so the opening camera stays zoomed in and an
  // accidental relocation south to Tacoma or north to Everett is caught.
  const SOUND_BOUNDS = {
    minLng: -122.65,
    maxLng: -122.10,
    minLat: 47.45,
    maxLat: 47.80,
  } as const

  /** Named landfall targets the roster is allowed to advance toward. */
  const PUGET_SOUND_TARGETS = new Set([
    'SEATTLE',
    'BELLEVUE',
    'MERCER ISLAND',
    'KIRKLAND',
  ])

  function inBounds(point: { lng: number; lat: number }): boolean {
    return (
      point.lng >= SOUND_BOUNDS.minLng &&
      point.lng <= SOUND_BOUNDS.maxLng &&
      point.lat >= SOUND_BOUNDS.minLat &&
      point.lat <= SOUND_BOUNDS.maxLat
    )
  }

  it('spawns and targets every leviathan within the Puget Sound bounds', () => {
    for (const lev of createRoster()) {
      expect(inBounds(lev.from)).toBe(true)
      expect(inBounds(lev.to)).toBe(true)
    }
  })

  it('names only Puget Sound landfall targets', () => {
    for (const lev of createRoster()) {
      expect(PUGET_SOUND_TARGETS.has(lev.target)).toBe(true)
    }
  })

  it('anchors the roster within the Puget Sound bounds', () => {
    expect(inBounds(ANCHOR)).toBe(true)
  })
})
