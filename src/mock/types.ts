// Domain model for the Kaiju Defense Network command center.

import type { ThreatLevel } from './severity'

/** Operational status of a tracked leviathan. */
export type LeviathanStatus =
  | 'SUBMERGED'
  | 'SURFACED'
  | 'INBOUND'
  | 'LANDFALL'
  | 'CONTAINED'

/** A tracked apex threat ("leviathan"). */
export interface Leviathan {
  /** Stable identifier. */
  id: string
  /** Operational call sign, e.g. "Gorathos". */
  codename: string
  /** Roman-numeral severity class, e.g. "IV". */
  classNumeral: string
  /** Behavioral archetype, e.g. "Abyssal Colossus". */
  archetype: string
  /** Live remaining range to landfall (km); map-owned, derived from the track. */
  range: number
  /** Height in meters. */
  height: number
  /** Travel speed in km/h. */
  speed: number
  /** Remaining containment hit points (counts down over time). */
  hp: number
  /** Maximum hit points, for HP-bar ratios. */
  hpMax: number
  /** Current operational status. */
  status: LeviathanStatus
  /** Longitude (WGS84). Spawn position; live position is derived from sim time. */
  lng: number
  /** Latitude (WGS84). Spawn position; live position is derived from sim time. */
  lat: number
  /** Current threat level on the Dormant -> Cataclysm scale. */
  threat: ThreatLevel
  /** Projected travel bearing in degrees (0 = north, clockwise to 360). */
  heading: number
  /** Inbound-track spawn point (open water) the leviathan advances from. */
  from: { lng: number; lat: number }
  /** Inbound-track landfall target the leviathan advances toward. */
  to: { lng: number; lat: number }
  /** Human-readable landfall target, e.g. "SAN FRANCISCO". */
  target: string
  /** Engagement range (km) at spawn; the track's full length in range terms. */
  startRange: number
  /** Dispatch knockback: track fraction the leviathan is currently shoved back
      (0 = closing normally), raised by dispatches and decaying each tick. */
  repel: number
}

/** Severity tag for a Signal Feed entry. */
export type SignalSeverity = 'INFO' | 'WARN' | 'OPS' | 'CRIT'

/** A single timestamped event in the Signal Feed. */
export interface SignalEvent {
  /** Stable identifier. */
  id: string
  /** Severity tag. */
  severity: SignalSeverity
  /** Human-readable message text. */
  message: string
  /** Event time (epoch milliseconds). */
  timestamp: number
  /** Optional link to the related leviathan by id. */
  leviathanId?: string
}

/** A deployable response asset with finite capacity. */
export interface DispatchUnit {
  /** Display name, e.g. "Scramble Jets". */
  name: string
  /** Remaining deployable capacity. */
  available: number
  /** Maximum capacity, for ratio displays. */
  capacity: number
}
