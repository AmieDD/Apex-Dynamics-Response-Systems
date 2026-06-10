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

/** Coastal anchor the roster spawns around (Pacific coastal metropolis). */
export const ANCHOR = { lng: -122.486, lat: 37.769 } as const

interface RosterSpec {
  codename: string
  archetype: string
  status: LeviathanStatus
  threat: ThreatLevel
}

/** Curated roster identity; numeric stats are seeded around these anchors. */
const ROSTER: readonly RosterSpec[] = [
  { codename: 'Gorathos', archetype: 'Abyssal Colossus', status: 'LANDFALL', threat: 'Cataclysm' },
  { codename: 'Vespyra', archetype: 'Tempest Wyrm', status: 'INBOUND', threat: 'Critical' },
  { codename: 'Terrakon', archetype: 'Tectonic Behemoth', status: 'SURFACED', threat: 'Elevated' },
  { codename: 'Nyxmora', archetype: 'Umbral Leviathan', status: 'SUBMERGED', threat: 'Stirring' },
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
      lng: round(ANCHOR.lng + between(rng, -0.35, 0.35), 4),
      lat: round(ANCHOR.lat + between(rng, -0.25, 0.25), 4),
      threat: spec.threat,
    }
  })
}

/** Clamps a number into [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Advances the roster one tick: bounded random-walk drift on telemetry stats
 * and a steady HP countdown. The PRNG defaults to time-seeded so live ticks
 * feel organic; pass a seed for reproducible tick sequences (tests).
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
      range: round(clamp(lev.range + between(rng, -1.5, 1.5), 4, 80), 1),
      speed: round(clamp(lev.speed + between(rng, -4, 4), 0, 120), 1),
      hp,
      // Gentle positional drift keeps markers alive without teleporting.
      lng: round(lev.lng + between(rng, -0.004, 0.004), 4),
      lat: round(lev.lat + between(rng, -0.003, 0.003), 4),
    }
  })
}
