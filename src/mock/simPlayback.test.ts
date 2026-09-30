// Timing rules for the sensor overlay replay: looping playback, the radar trail
// window, inclusive station-activity edges, and a pulse that fades between
// arrivals instead of flickering on and off.

import { describe, expect, it } from 'vitest'

import type { SimOverlay } from './simOverlay'
import {
  asOverlay,
  indexSeismic,
  playbackTime,
  radarFeatures,
  radarWindow,
  snapshotWindow,
  stationFeatures,
  stationPulses,
} from './simPlayback'
import committed from './simOverlay.json'

const OVERLAY: SimOverlay = {
  overlayVersion: 'sim-overlay-v1',
  scenarioId: 'test',
  epochMs: 0,
  durationMs: 100_000,
  stations: [
    { stationId: 'a', lat: 47.6, lng: -122.3 },
    { stationId: 'b', lat: 47.7, lng: -122.2 },
  ],
  radar: [
    { t: 1_000, lat: 47.61, lng: -122.31 },
    { t: 50_000, lat: 47.62, lng: -122.32 },
  ],
  seismic: [
    { t: 20_000, stationId: 'a', amplitude: 0.1 },
    { t: 25_000, stationId: 'a' },
  ],
}

describe('playbackTime', () => {
  it('advances by speed and wraps at the recording duration', () => {
    expect(playbackTime(1, 100_000, 40)).toBe(40_000)
    expect(playbackTime(2.5, 100_000, 40)).toBe(0)
    expect(playbackTime(3, 100_000, 40)).toBe(20_000)
  })
})

describe('radarWindow', () => {
  it('spans the trail up to the cursor', () => {
    expect(radarWindow(50_000, 10_000)).toEqual({ from: 40_000, to: 50_000 })
  })

  it('covers the whole recording in the reduced-motion snapshot', () => {
    expect(snapshotWindow(OVERLAY)).toEqual({ from: 0, to: 100_000 })
  })
})

describe('stationPulses', () => {
  const index = indexSeismic(OVERLAY)

  it('is 1 at an arrival and 0 at the inclusive far edge of the window', () => {
    expect(stationPulses(index, 20_000, 10_000).get('a')).toBe(1)
    expect(stationPulses(index, 35_000, 10_000).get('a')).toBe(0)
    expect(stationPulses(index, 35_001, 10_000).get('a')).toBe(0)
  })

  it('fades continuously and resets on the next arrival', () => {
    const early = stationPulses(index, 22_000, 10_000).get('a')!
    const later = stationPulses(index, 24_000, 10_000).get('a')!
    expect(early).toBeCloseTo(0.8)
    expect(later).toBeCloseTo(0.6)
    expect(stationPulses(index, 25_000, 10_000).get('a')).toBe(1)
  })

  it('is 0 for stations without arrivals and before the first arrival', () => {
    expect(stationPulses(index, 30_000, 10_000).get('b')).toBe(0)
    expect(stationPulses(index, 19_999, 10_000).get('a')).toBe(0)
  })

  it('carries a pulse from the end of the recording across the loop point', () => {
    const looped = indexSeismic({ ...OVERLAY, seismic: [{ t: 98_000, stationId: 'b' }] }, 10_000)
    expect(stationPulses(looped, 99_000, 10_000).get('b')).toBeCloseTo(0.9)
    expect(stationPulses(looped, 3_000, 10_000).get('b')).toBeCloseTo(0.5)
    expect(stationPulses(looped, 8_000, 10_000).get('b')).toBe(0)
  })
})

describe('features', () => {
  it('builds radar points once with their measured time', () => {
    const radar = radarFeatures(OVERLAY, 10_000)
    expect(radar.features.map((f) => f.properties.t)).toEqual([1_000, 50_000])
    expect(radar.features[0].geometry.coordinates).toEqual([-122.31, 47.61])
  })

  it('repeats the recording tail one loop earlier so the trail wraps', () => {
    const radar = radarFeatures({ ...OVERLAY, radar: [...OVERLAY.radar, { t: 95_000, lat: 47.63, lng: -122.33 }] }, 10_000)
    expect(radar.features.map((f) => f.properties.t)).toEqual([-5_000, 1_000, 50_000, 95_000])
    expect(radar.features[0].geometry.coordinates).toEqual([-122.33, 47.63])
  })

  it('carries each station pulse', () => {
    const stations = stationFeatures(OVERLAY, new Map([['a', 0.5]]))
    expect(stations.features.map((f) => f.properties)).toEqual([
      { stationId: 'a', pulse: 0.5 },
      { stationId: 'b', pulse: 0 },
    ])
  })
})

describe('asOverlay', () => {
  it('accepts the committed overlay', () => {
    const overlay = asOverlay(committed)
    expect(overlay.stations).toHaveLength(4)
    expect(overlay.radar.length).toBeGreaterThan(0)
  })

  it('rejects anything else', () => {
    expect(() => asOverlay({ overlayVersion: 'other' })).toThrow(/sim-overlay-v1/)
    expect(() => asOverlay(null)).toThrow(/sim-overlay-v1/)
  })
})
