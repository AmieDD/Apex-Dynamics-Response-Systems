// Mocked Signal Feed generator for the Kaiju Defense Network.
//
// Events are produced from canned phrase pools on Poisson-like arrival
// intervals so the feed reads as an organic live stream rather than a
// fixed-rate ticker. Randomness comes from a small seedable PRNG (seedrandom,
// already used by the roster) so the heavy @faker-js/faker dependency stays out
// of the bundle.

import seedrandom from 'seedrandom'

import type { Leviathan, SignalEvent, SignalSeverity } from './types'

/** Default rolling-buffer cap for the feed. */
export const FEED_BUFFER_CAP = 50

const SENSORS = [
  'COASTAL ARRAY',
  'ORBITAL UPLINK',
  'SEISMIC GRID',
  'SONAR PICKET',
  'THERMAL DRONE',
  'CIVIL DEFENSE NET',
] as const

const SECTORS = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT'] as const

/** WARN-flavored anomaly clauses (replaces faker.hacker.phrase()). */
const WARN_CLAUSES = [
  'energy signature spiking past safe thresholds',
  'hull-displacement wake widening fast',
  'bioelectric surge scrambling nearby sensors',
  'dive profile flattening toward an attack run',
  'thermal bloom consistent with an imminent surface',
  'harmonic roar registering across the seismic grid',
] as const

/** OPS clauses for a leviathan-linked dispatch update (replaces catchPhrase). */
const LINKED_OPS_CLAUSES = [
  'interception lattice realigning to its heading',
  'shore batteries walking fire onto its track',
  'mech wing vectoring for a flanking push',
  'barrier grid charging along the projected path',
] as const

/** OPS clauses for an untargeted sector action (replaces buzzPhrase). */
const SECTOR_OPS_CLAUSES = [
  'Mobilizing the rapid-response wing',
  'Hardening the seawall cordon',
  'Staging evacuation corridors',
  'Routing reserve power to the barrier grid',
] as const

// Module-level PRNG. Defaults to a time-based seed for organic variety across
// loads; tests call seedFeed() to pin it for reproducible assertions.
let rng = seedrandom(String(Date.now()))
let idCounter = 0

/** Seeds the feed PRNG for reproducible streams (tests). */
export function seedFeed(seed: number): void {
  rng = seedrandom(String(seed))
  idCounter = 0
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length]
}

/** Monotonic, collision-free event id (replaces faker.string.uuid()). */
function nextId(): string {
  idCounter += 1
  return `sig-${idCounter.toString(36)}-${Math.floor(rng() * 0xfffff).toString(36)}`
}

function messageFor(severity: SignalSeverity, leviathan?: Leviathan): string {
  const sensor = pick(SENSORS)
  const sector = pick(SECTORS)

  if (leviathan) {
    switch (severity) {
      case 'WARN':
        return `${sensor}: ${leviathan.codename} tracking toward Sector ${sector} — ${pick(WARN_CLAUSES)}`
      case 'OPS':
        return `Dispatch update on ${leviathan.codename}: ${pick(LINKED_OPS_CLAUSES)}`
      default:
        return `${sensor} contact: ${leviathan.codename} signature stable in Sector ${sector}.`
    }
  }

  switch (severity) {
    case 'WARN':
      return `${sensor}: anomalous reading in Sector ${sector} — ${pick(WARN_CLAUSES)}`
    case 'OPS':
      return `Operations: ${pick(SECTOR_OPS_CLAUSES)} for Sector ${sector}.`
    default:
      return `${sensor} nominal across Sector ${sector}.`
  }
}

/**
 * Creates a single Signal Feed event. Pass the active roster to occasionally
 * link an event to a specific leviathan.
 */
export function makeSignalEvent(
  leviathans: readonly Leviathan[] = [],
  now: number = Date.now(),
): SignalEvent {
  // Weight toward INFO, with occasional WARN/OPS for texture.
  const roll = rng()
  const severity: SignalSeverity = roll < 0.6 ? 'INFO' : roll < 0.82 ? 'WARN' : 'OPS'

  const linkChance = severity === 'WARN' ? 0.7 : 0.35
  const leviathan =
    leviathans.length > 0 && rng() < linkChance
      ? pick(leviathans)
      : undefined

  return {
    id: nextId(),
    severity,
    message: messageFor(severity, leviathan),
    timestamp: now,
    leviathanId: leviathan?.id,
  }
}

/** Appends an event and trims the buffer to `cap`, keeping the most recent. */
export function appendCapped(
  buffer: readonly SignalEvent[],
  event: SignalEvent,
  cap: number = FEED_BUFFER_CAP,
): SignalEvent[] {
  const next = [event, ...buffer]
  return next.length > cap ? next.slice(0, cap) : next
}

/** Cancels a pending scheduled arrival. */
export type CancelSchedule = () => void

/**
 * Schedules `cb` on a Poisson-like interval. Inter-arrival times are drawn from
 * an exponential distribution as `-ln(U) / rate`, producing irregular natural
 * gaps. Re-arms itself after each fire; call the returned function to stop.
 *
 * @param ratePerMin Expected number of arrivals per minute.
 */
export function scheduleNext(cb: () => void, ratePerMin: number): CancelSchedule {
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancelled = false

  const ratePerMs = Math.max(ratePerMin, 0.001) / 60_000

  const arm = (): void => {
    const u = Math.random() || Number.EPSILON
    const intervalMs = -Math.log(u) / ratePerMs
    timer = setTimeout(() => {
      if (cancelled) return
      cb()
      arm()
    }, intervalMs)
  }

  arm()

  return () => {
    cancelled = true
    if (timer !== undefined) clearTimeout(timer)
  }
}
