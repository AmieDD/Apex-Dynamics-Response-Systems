// Contract tests for the Scenario Studio overlay builder: station conversion,
// alternate-format and alias normalization, duplicate handling, deterministic
// ordering, and a strict output-key whitelist so no identity or private field
// can leak into the committed overlay.

import { describe, expect, it } from 'vitest'

import { buildOverlay, serializeOverlay, type SimOverlay } from './simOverlay'

const FRAME = { originLatitude: 47.606, originLongitude: -122.333, radiusMeters: 6371008.8 }
const META = { scenarioId: 'test-scenario', epochMs: 1784538000000, durationMs: 60000, frame: FRAME }

function catalog(): Record<string, unknown> {
  return {
    ...META,
    schemaVersion: 'multi-sensor-v2',
    sensorSeed: 'sensor-v1',
    records: [
      { stationId: 'station-1', xMeters: 9646.997372793865, yMeters: 13123.253395633796 },
      { stationId: 'station-2', xMeters: -5571.126376957014, yMeters: 4663.876711794017 },
    ],
  }
}

function delivery(deliveryId: string, stream: string, reading: Record<string, unknown>) {
  return { deliveryId, receivedAtMs: 0, stream, reading }
}

function feed(records: unknown[]): Record<string, unknown> {
  return {
    ...META,
    schemaVersion: 'delivery-feed-v4',
    profile: { version: 'delivery-v3', alternateStations: ['station-2'] },
    stationAliases: [{ stationId: 'station-2', alias: 'STN-001' }],
    records,
  }
}

const RADAR = delivery('d-r1-0', 'radar', { readingId: 'r1', timestampMs: 2000.4, latitude: 47.68123456789, longitude: -122.42 })
const STANDARD = delivery('d-s1-0', 'seismic', { readingId: 's1', timestampMs: 1000, stationId: 'station-1', amplitude: 0.021504786, dominantFrequencyHz: 8 })
const ALTERNATE = delivery('d-s2-0', 'seismic', { reading_id: 's2', timestamp_ms: 1500.6, station_id: 'STN-001', freq_hz: 9 })

describe('buildOverlay', () => {
  it('converts stations to lat/lng with the bundle frame', () => {
    const { stations } = buildOverlay(feed([]), catalog())
    expect(stations.map((s) => s.stationId)).toEqual(['station-1', 'station-2'])
    expect(stations[0].lat).toBeCloseTo(47.72402, 6)
    expect(stations[0].lng).toBeCloseTo(-122.204323, 6)
    expect(stations[1].lat).toBeCloseTo(47.647943, 6)
    expect(stations[1].lng).toBeCloseTo(-122.407311, 6)
  })

  it('normalizes alternate names and aliases, keeping missing amplitude absent', () => {
    const { seismic } = buildOverlay(feed([STANDARD, ALTERNATE]), catalog())
    expect(seismic).toEqual([
      { t: 1000, stationId: 'station-1', amplitude: 0.0215 },
      { t: 1501, stationId: 'station-2' },
    ])
    expect(Object.hasOwn(seismic[1], 'amplitude')).toBe(false)
  })

  it('rounds radar time to ms and position to 6 decimals', () => {
    const { radar } = buildOverlay(feed([RADAR]), catalog())
    expect(radar).toEqual([{ t: 2000, lat: 47.681235, lng: -122.42 }])
  })

  it('collapses duplicate deliveries of the same reading', () => {
    const copy = { ...RADAR, deliveryId: 'd-r1-1', receivedAtMs: 50 }
    expect(buildOverlay(feed([RADAR, copy]), catalog()).radar).toHaveLength(1)
  })

  it('rejects duplicates whose measurements conflict', () => {
    const conflict = delivery('d-r1-1', 'radar', { readingId: 'r1', timestampMs: 2000.4, latitude: 47.7, longitude: -122.42 })
    expect(() => buildOverlay(feed([RADAR, conflict]), catalog())).toThrow(/conflicting duplicate/)
  })

  it('produces identical output regardless of delivery order', () => {
    const extra = delivery('d-r2-0', 'radar', { readingId: 'r2', timestampMs: 2000.2, latitude: 47.6, longitude: -122.3 })
    const a = serializeOverlay(buildOverlay(feed([RADAR, STANDARD, ALTERNATE, extra]), catalog()))
    const b = serializeOverlay(buildOverlay(feed([extra, ALTERNATE, RADAR, STANDARD]), catalog()))
    expect(a).toBe(b)
  })

  it('emits only whitelisted keys', () => {
    const overlay: SimOverlay = buildOverlay(feed([RADAR, STANDARD, ALTERNATE]), catalog())
    expect(Object.keys(overlay).sort()).toEqual(
      ['durationMs', 'epochMs', 'overlayVersion', 'radar', 'scenarioId', 'seismic', 'stations'],
    )
    for (const s of overlay.stations) expect(Object.keys(s).sort()).toEqual(['lat', 'lng', 'stationId'])
    for (const r of overlay.radar) expect(Object.keys(r).sort()).toEqual(['lat', 'lng', 't'])
    for (const s of overlay.seismic) {
      expect(Object.keys(s).every((key) => ['amplitude', 'stationId', 't'].includes(key))).toBe(true)
    }
  })

  it('rejects unsupported schema versions', () => {
    expect(() => buildOverlay({ ...feed([]), schemaVersion: 'delivery-feed-v3' }, catalog())).toThrow(/delivery-feed-v3/)
    expect(() => buildOverlay(feed([]), { ...catalog(), schemaVersion: 'multi-sensor-v1' })).toThrow(/multi-sensor-v1/)
  })

  it('rejects unknown aliases and mismatched station formats', () => {
    const unknown = delivery('d-s3-0', 'seismic', { reading_id: 's3', timestamp_ms: 10, station_id: 'STN-999' })
    expect(() => buildOverlay(feed([unknown]), catalog())).toThrow(/unknown station alias/)
    const standardForAlternate = delivery('d-s4-0', 'seismic', { readingId: 's4', timestampMs: 10, stationId: 'station-2' })
    expect(() => buildOverlay(feed([standardForAlternate]), catalog())).toThrow(/wrong format/)
  })

  it('rejects feeds and catalogs from different scenarios', () => {
    expect(() => buildOverlay({ ...feed([]), scenarioId: 'other' }, catalog())).toThrow(/different scenarios/)
  })
})

describe('serializeOverlay', () => {
  it('round-trips with LF endings and a final newline', () => {
    const overlay = buildOverlay(feed([RADAR, STANDARD, ALTERNATE]), catalog())
    const text = serializeOverlay(overlay)
    expect(text.endsWith('}\n')).toBe(true)
    expect(text.includes('\r')).toBe(false)
    expect(JSON.parse(text)).toEqual(overlay)
  })
})
