// Mocked Signal Feed generator for the Kaiju Defense Network.
//
// Events are produced with faker text on Poisson-like arrival intervals so the
// feed reads as an organic live stream rather than a fixed-rate ticker.

import { faker } from '@faker-js/faker'

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

/** Optionally seed the underlying faker PRNG for reproducible feeds (tests). */
export function seedFeed(seed: number): void {
  faker.seed(seed)
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(faker.number.float({ min: 0, max: 1 }) * items.length) % items.length]
}

function messageFor(severity: SignalSeverity, leviathan?: Leviathan): string {
  const sensor = pick(SENSORS)
  const sector = pick(SECTORS)

  if (leviathan) {
    switch (severity) {
      case 'WARN':
        return `${sensor}: ${leviathan.codename} tracking toward Sector ${sector} — ${faker.hacker.phrase()}`
      case 'OPS':
        return `Dispatch update on ${leviathan.codename}: ${faker.company.catchPhrase()}`
      default:
        return `${sensor} contact: ${leviathan.codename} signature stable in Sector ${sector}.`
    }
  }

  switch (severity) {
    case 'WARN':
      return `${sensor}: anomalous reading in Sector ${sector} — ${faker.hacker.phrase()}`
    case 'OPS':
      return `Operations: ${faker.company.buzzPhrase()} for Sector ${sector}.`
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
  const roll = faker.number.float({ min: 0, max: 1 })
  const severity: SignalSeverity = roll < 0.6 ? 'INFO' : roll < 0.82 ? 'WARN' : 'OPS'

  const linkChance = severity === 'WARN' ? 0.7 : 0.35
  const leviathan =
    leviathans.length > 0 && faker.number.float({ min: 0, max: 1 }) < linkChance
      ? pick(leviathans)
      : undefined

  return {
    id: faker.string.uuid(),
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
