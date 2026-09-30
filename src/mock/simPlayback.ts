// Playback helpers for the Scenario Studio sensor overlay on the command map.
// Maps the map's sim clock onto scenario time and derives what to draw at that
// instant: the radar trail window and a fading pulse per seismic station. Pure
// (no React or MapLibre) so the timing rules are unit-testable.

import type { Feature, FeatureCollection, Point } from 'geojson'

import { OVERLAY_VERSION, type SimOverlay } from './simOverlay'

/** Scenario milliseconds replayed per real millisecond. */
export const PLAYBACK_SPEED = 40

/** How much scenario time of radar returns stays visible behind the cursor. */
export const RADAR_TRAIL_MS = 120_000

/** How long a station's pulse lasts after a seismic arrival (scenario ms). */
export const STATION_ACTIVITY_MS = 10_000

/** Pulse map with every station at rest (reduced motion). */
export const NO_PULSES: ReadonlyMap<string, number> = new Map()

export interface RadarProps {
  t: number
}

export interface StationProps {
  stationId: string
  /** 1 at a fresh seismic arrival, fading to 0 across the activity window. */
  pulse: number
}

/** Inclusive scenario-time bounds of radar returns to draw. */
export interface TimeWindow {
  from: number
  to: number
}

/** Narrows an imported overlay JSON value to the `sim-overlay-v1` contract. */
export function asOverlay(value: unknown): SimOverlay {
  const overlay = value as Partial<SimOverlay> | null
  if (
    overlay?.overlayVersion !== OVERLAY_VERSION ||
    typeof overlay.durationMs !== 'number' ||
    overlay.durationMs <= 0 ||
    !Array.isArray(overlay.stations) ||
    !Array.isArray(overlay.radar) ||
    !Array.isArray(overlay.seismic)
  ) {
    throw new Error(`Sensor overlay is not ${OVERLAY_VERSION}`)
  }
  return overlay as SimOverlay
}

/** Scenario time (ms) shown at a given sim-clock second, looping over the recording. */
export function playbackTime(simTimeSeconds: number, durationMs: number, speed: number = PLAYBACK_SPEED): number {
  const elapsed = simTimeSeconds * 1000 * speed
  return ((elapsed % durationMs) + durationMs) % durationMs
}

/** Radar returns from the trail start through the playback cursor. */
export function radarWindow(playback: number, trailMs: number = RADAR_TRAIL_MS): TimeWindow {
  return { from: playback - trailMs, to: playback }
}

/** Reduced-motion view: every radar return in the recording, no animation. */
export function snapshotWindow(overlay: SimOverlay): TimeWindow {
  return { from: 0, to: overlay.durationMs }
}

/** Copies of items in the last `lookbackMs` of the recording, shifted one loop
    earlier so windows reaching below 0 wrap into the previous pass. */
function loopTail<T extends { t: number }>(items: readonly T[], durationMs: number, lookbackMs: number): T[] {
  return items.filter((item) => item.t > durationMs - lookbackMs).map((item) => ({ ...item, t: item.t - durationMs }))
}

/** Index of the last element `<= value` in an ascending array, or -1. */
function lastAtOrBefore(sorted: readonly number[], value: number): number {
  let low = 0
  let high = sorted.length - 1
  let found = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (sorted[mid] <= value) {
      found = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return found
}

/** Per-station ascending seismic arrival times, including the looped tail;
    build once per overlay. */
export function indexSeismic(overlay: SimOverlay, windowMs: number = STATION_ACTIVITY_MS): Map<string, number[]> {
  const index = new Map<string, number[]>(overlay.stations.map((s) => [s.stationId, []]))
  const arrivals = [...loopTail(overlay.seismic, overlay.durationMs, windowMs), ...overlay.seismic]
  for (const reading of arrivals) index.get(reading.stationId)?.push(reading.t)
  for (const times of index.values()) times.sort((a, b) => a - b)
  return index
}

/**
 * Pulse strength per station at `playback`: 1 for an arrival exactly at the
 * cursor, falling linearly to 0 for one `windowMs` earlier (inclusive), and 0
 * when no arrival is in `[playback - windowMs, playback]`.
 */
export function stationPulses(
  index: ReadonlyMap<string, readonly number[]>,
  playback: number,
  windowMs: number = STATION_ACTIVITY_MS,
): Map<string, number> {
  const pulses = new Map<string, number>()
  for (const [stationId, times] of index) {
    const i = lastAtOrBefore(times, playback)
    const age = i < 0 ? Infinity : playback - times[i]
    pulses.set(stationId, age <= windowMs ? 1 - age / windowMs : 0)
  }
  return pulses
}

/** Static radar collection, including the looped tail (negative `t`);
    per-frame visibility comes from a layer filter on `t`. */
export function radarFeatures(overlay: SimOverlay, trailMs: number = RADAR_TRAIL_MS): FeatureCollection<Point, RadarProps> {
  return {
    type: 'FeatureCollection',
    features: [...loopTail(overlay.radar, overlay.durationMs, trailMs), ...overlay.radar].map(
      (r): Feature<Point, RadarProps> => ({
        type: 'Feature',
        properties: { t: r.t },
        geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      }),
    ),
  }
}

/** Station collection carrying each station's current pulse strength. */
export function stationFeatures(
  overlay: SimOverlay,
  pulses: ReadonlyMap<string, number>,
): FeatureCollection<Point, StationProps> {
  return {
    type: 'FeatureCollection',
    features: overlay.stations.map(
      (s): Feature<Point, StationProps> => ({
        type: 'Feature',
        properties: { stationId: s.stationId, pulse: pulses.get(s.stationId) ?? 0 },
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      }),
    ),
  }
}
