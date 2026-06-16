// Deterministic seeded leviathan roster for the Kaiju Defense Network.
//
// The roster is generated from a fixed seed so the same set of leviathans
// (names, coordinates, base stats) appears on every load. `tickLeviathans`
// applies bounded per-tick drift and an HP countdown for the live feel without
// breaking determinism of the initial roster.

import seedrandom from 'seedrandom'

import { THREAT_LEVELS, type ThreatLevel } from './severity'
import type { Leviathan, LeviathanStatus } from './types'

/** Fixed seed for the initial roster — change to reshuffle the world. */
export const ROSTER_SEED = 'kaiju-defense-network-v1'

/** Coastal anchor the roster spawns around (Puget Sound metropolis). */
export const ANCHOR = { lng: -122.335, lat: 47.606 } as const

interface RosterSpec {
  codename: string
  archetype: string
  status: LeviathanStatus
  threat: ThreatLevel
  /** Inbound-track spawn point (open water). */
  from: { lng: number; lat: number }
  /** Inbound-track landfall target. */
  to: { lng: number; lat: number }
  /** Human-readable landfall target name. */
  target: string
  /** Engagement range (km) at spawn; the track's full length. */
  startRange: number
}

/** Curated roster identity; numeric stats are seeded around these anchors.
    Track endpoints are real Puget Sound coordinates so each leviathan advances
    from open water toward a named coastal target. */
const ROSTER: readonly RosterSpec[] = [
  {
    codename: 'Gorathos', archetype: 'Abyssal Colossus', status: 'LANDFALL', threat: 'Cataclysm',
    from: { lng: -122.470, lat: 47.660 }, to: { lng: -122.345, lat: 47.606 },
    target: 'SEATTLE', startRange: 215,
  },
  {
    codename: 'Vespyra', archetype: 'Tempest Wyrm', status: 'INBOUND', threat: 'Critical',
    from: { lng: -122.540, lat: 47.560 }, to: { lng: -122.200, lat: 47.610 },
    target: 'BELLEVUE', startRange: 91,
  },
  {
    codename: 'Terrakon', archetype: 'Tectonic Behemoth', status: 'SURFACED', threat: 'Elevated',
    from: { lng: -122.560, lat: 47.230 }, to: { lng: -122.438, lat: 47.268 },
    target: 'TACOMA', startRange: 201,
  },
  {
    codename: 'Nyxmora', archetype: 'Umbral Leviathan', status: 'SUBMERGED', threat: 'Stirring',
    from: { lng: -122.360, lat: 47.985 }, to: { lng: -122.215, lat: 47.978 },
    target: 'EVERETT', startRange: 342,
  },
] as const

const ROMAN = ['I', 'II', 'III', 'IV', 'V'] as const

/** Roman-numeral class derived from threat rank (Dormant=I ... Cataclysm=V). */
function classNumeralFor(threat: ThreatLevel): string {
  return ROMAN[THREAT_LEVELS.indexOf(threat)]
}

/** Returns a value in [min, max) from the supplied PRNG. */
function between(rng: seedrandom.PRNG, min: number, max: number): number {
  return min + rng() * (max - min)
}

function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * Builds the deterministic roster. Given the same seed, the returned
 * leviathans are byte-for-byte identical across calls.
 */
export function createRoster(seed: string = ROSTER_SEED): Leviathan[] {
  const rng = seedrandom(seed)

  return ROSTER.map((spec, index) => {
    const hpMax = round(between(rng, 6000, 12000))
    // Higher threat starts with proportionally lower remaining HP.
    const hpFraction = 0.45 + (THREAT_LEVELS.length - THREAT_LEVELS.indexOf(spec.threat)) * 0.1
    const hp = round(hpMax * Math.min(hpFraction, 0.95))

    return {
      id: `lev-${index + 1}`,
      codename: spec.codename,
      classNumeral: classNumeralFor(spec.threat),
      archetype: spec.archetype,
      range: round(between(rng, 8, 60), 1),
      height: round(between(rng, 60, 180)),
      speed: round(between(rng, 12, 95), 1),
      hp,
      hpMax,
      status: spec.status,
      // Spawn position; the live map position is derived from sim time along
      // the from -> to track (see posFromFrac / fracAt below).
      lng: spec.from.lng,
      lat: spec.from.lat,
      threat: spec.threat,
      heading: round(between(rng, 0, 360)),
      from: spec.from,
      to: spec.to,
      target: spec.target,
      startRange: spec.startRange,
      repel: 0,
    }
  })
}

/** Clamps a number into [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// --- Dispatch knockback (MOCKED) --------------------------------------------
// Deploying a response asset against a leviathan shoves it back along its
// inbound track. The shove is a fraction of the track subtracted from the
// natural advance (applied in CommandMap), accumulating per dispatch up to a
// cap and decaying a little each heartbeat tick until the leviathan resumes
// closing. This is the seam where a real engagement model would plug in.

/** Track fraction a single dispatch pushes the targeted leviathan back. */
export const REPEL_KNOCKBACK_FRAC = 0.18

/** Maximum accumulated knockback (fraction of track) from stacked dispatches. */
export const REPEL_KNOCKBACK_MAX = 0.6

/** Knockback (fraction) shed each 1s heartbeat tick as the leviathan recovers. */
export const REPEL_DECAY_PER_TICK = 0.04

/**
 * Advances the roster one tick: bounded random-walk drift on speed and a
 * steady HP countdown. Range and position are map-owned (track-derived) and
 * left untouched here. The PRNG defaults to time-seeded so live ticks feel
 * organic; pass a seed for reproducible tick sequences (tests).
 */
export function tickLeviathans(
  leviathans: readonly Leviathan[],
  seed?: string,
): Leviathan[] {
  const rng = seedrandom(seed ?? String(Date.now()))

  return leviathans.map((lev) => {
    const hp = clamp(lev.hp - round(between(rng, 1, 28)), 0, lev.hpMax)
    return {
      ...lev,
      speed: round(clamp(lev.speed + between(rng, -4, 4), 0, 120), 1),
      hp,
      // Dispatch knockback recovers a little each tick (0 = fully closing in).
      repel: round(Math.max(0, lev.repel - REPEL_DECAY_PER_TICK), 2),
      // Position and remaining range are derived from sim time along the
      // from -> to track (posFromFrac / rangeFromFrac), so the stored lng/lat
      // and range stay map-owned here (no random drift).
    }
  })
}

// --- Inbound-track motion model (MOCKED) ------------------------------------
// Scripted inbound motion: a leviathan's remaining range falls linearly with
// sim time at a rate proportional to its speed, then wraps so the demo loops
// forever. Positions are a straight-line lerp from `from` (spawn) to `to`
// (landfall). This is the seam where live HVE Core tracks would plug in.

/** Fraction of a track's length covered per (km/h · sim-second). Not physics. */
export const CLOSURE_RATE = 0.05

/** Range thresholds (km) that separate the inbound status bands. */
const LANDFALL_RANGE_KM = 25
const SURFACED_RANGE_KM = 70

/** Minimal pacing inputs shared by the inbound-motion interpolators. */
export interface TrackPace {
  /** Travel speed (km/h) driving closure rate. */
  speed: number
  /** Engagement range (km) at spawn; the track's full length. */
  startRange: number
}

/** Normalized progress (0 = spawn, 1 = landfall) at a given sim time; wraps. */
export function fracAt(track: TrackPace, simTime: number): number {
  const shed = track.speed * CLOSURE_RATE * simTime
  return (shed % track.startRange) / track.startRange
}

/** Whole-number landfall cycles completed by a given sim time. */
export function cycleAt(track: TrackPace, simTime: number): number {
  return Math.floor((track.speed * CLOSURE_RATE * simTime) / track.startRange)
}

/** Remaining range (km) for a given progress fraction. */
export function rangeFromFrac(startRange: number, frac: number): number {
  return startRange * (1 - frac)
}

/** Interpolated position for a given progress fraction. */
export function posFromFrac(
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
  frac: number,
): { lng: number; lat: number } {
  return {
    lng: from.lng + (to.lng - from.lng) * frac,
    lat: from.lat + (to.lat - from.lat) * frac,
  }
}

/** Inbound status band derived from remaining range. */
export function statusFromRange(rangeKm: number): LeviathanStatus {
  if (rangeKm < LANDFALL_RANGE_KM) return 'LANDFALL'
  if (rangeKm < SURFACED_RANGE_KM) return 'SURFACED'
  return 'INBOUND'
}

/**
 * Estimated sim-seconds until a leviathan reaches landfall (range 0) at its
 * current closure rate. Range falls by `speed · CLOSURE_RATE` km per sim-second,
 * so the time to close the remaining range is range / that rate. Returns
 * `Infinity` when the leviathan is not closing (speed 0) — a held target.
 */
export function etaToLandfall(rangeKm: number, speed: number): number {
  const closurePerSecond = speed * CLOSURE_RATE
  if (closurePerSecond <= 0) return Infinity
  return rangeKm / closurePerSecond
}

/**
 * Formats an ETA (sim-seconds) for the roster readout: `HOLD` when the target
 * is not closing, a bare `48s` under a minute, or `2m 17s` above it.
 */
export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'HOLD'
  const whole = Math.max(0, Math.round(seconds))
  if (whole < 60) return `${whole}s`
  const minutes = Math.floor(whole / 60)
  const remainder = whole % 60
  return `${minutes}m ${remainder.toString().padStart(2, '0')}s`
}

/**
 * Static progress fraction used when the user prefers reduced motion: higher
 * threat sits closer to landfall so the map reads as a meaningful snapshot
 * without any travel animation.
 */
export function staticFracFor(threat: ThreatLevel): number {
  const byRank = [0.12, 0.3, 0.5, 0.7, 0.92] as const
  return byRank[THREAT_LEVELS.indexOf(threat)] ?? 0.4
}

/** Track geometry + pace for the live advance: spawn/landfall endpoints plus
    the pacing inputs (a superset of {@link TrackPace}). */
export interface AdvanceTrack extends TrackPace {
  /** Open-water spawn point. */
  from: { lng: number; lat: number }
  /** Landfall target point. */
  to: { lng: number; lat: number }
}

/** Resolved live render state for a single leviathan at a moment in sim time. */
export interface LeviathanAdvance {
  /** Live progress fraction (0 = spawn ... 1 = landfall). */
  frac: number
  /** Interpolated map position at that fraction. */
  pos: { lng: number; lat: number }
  /** Remaining range to landfall (km). */
  rangeKm: number
  /** Inbound status band derived from the remaining range. */
  status: LeviathanStatus
  /** Formatted ETA to landfall (or `HOLD`). */
  eta: string
}

/**
 * Resolves a leviathan's live render state from the scripted track and the sim
 * clock: the natural closure fraction less any dispatch knockback (clamped at
 * spawn), or a static threat-based snapshot under reduced motion, expanded to
 * position, remaining range, status band, and ETA. Pure — drives both the map
 * markers and the side-panel readouts, so locking it down here guards both.
 *
 * `speed` is the leviathan's live speed (for the ETA readout), which can drift
 * apart from the frozen `track.speed` that paces the scripted advance.
 */
export function deriveAdvance(
  track: AdvanceTrack,
  threat: ThreatLevel,
  repel: number,
  speed: number,
  simTime: number,
  reducedMotion: boolean,
): LeviathanAdvance {
  const frac = reducedMotion
    ? staticFracFor(threat)
    : Math.max(0, fracAt(track, simTime) - repel)
  const pos = posFromFrac(track.from, track.to, frac)
  const rangeKm = rangeFromFrac(track.startRange, frac)
  const status = statusFromRange(rangeKm)
  const eta = formatEta(etaToLandfall(rangeKm, speed))
  return { frac, pos, rangeKm, status, eta }
}
