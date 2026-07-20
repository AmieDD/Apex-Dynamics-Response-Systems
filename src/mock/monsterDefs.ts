// Known-monster definitions for the Kaiju Sensor Grid.
//
// This is the single typed source of truth for monster identities, traits, and
// inbound tracks. It doubles as the attribution reference list (known monsters)
// and the input to the seeded ping simulator. Codenames and Puget Sound track
// endpoints are reused from the live roster (src/mock/leviathans.ts) so the sim
// stays in the same fictional world.
//
// Attribution traits that do NOT exist on the app's `Leviathan` domain type
// (`weightTons`, `heightMeters`, `submerged`) live here by design: this is a
// separate sensor/attribution artifact and keeping them local leaves the core
// domain model untouched.

/** A geographic point (WGS84). */
interface GeoPoint {
  lng: number
  lat: number
}

/** A known-monster definition: identity, traits, and inbound track. */
export interface MonsterDef {
  /** Stable identifier. */
  id: string
  /** Operational call sign, e.g. "Gorathos". */
  codename: string
  /** Behavioral archetype, e.g. "Abyssal Colossus". */
  archetype: string
  /** Height in meters. */
  heightMeters: number
  /** Mass in metric tons (attribution trait; not on `Leviathan`). */
  weightTons: number
  /** Travel speed in km/h. */
  speedKmh: number
  /** Whether the monster travels underwater (drives ping elevation sign). */
  submerged: boolean
  /** Inbound-track spawn point (open water). */
  spawn: GeoPoint
  /** Human-readable landfall target, e.g. "SEATTLE". */
  target: string
  /** Inbound-track landfall coordinate. */
  targetPos: GeoPoint
  /** Epoch-ms base offset for this monster's first ping. */
  spawnAt: number
  /** Pings sampled along the track. */
  trackSteps: number
}

/** Fixed base epoch (ms) the monster tracks are anchored to. */
const SIM_EPOCH = Date.UTC(2026, 6, 20, 9, 0, 0)

/** Per-monster spawn stagger (ms) so merged ping streams interleave. */
const SPAWN_STAGGER = 375

/**
 * The known-monster reference set. The first four reuse the live roster's
 * codenames and track endpoints; the last two spawn from the coastal anchor
 * region. 
 */
export const MONSTER_DEFS: readonly MonsterDef[] = [
  {
    id: 'mon-1',
    codename: 'Gorathos',
    archetype: 'Abyssal Colossus',
    heightMeters: 142,
    weightTons: 88000,
    speedKmh: 34.5,
    submerged: false,
    spawn: { lng: -122.470, lat: 47.660 },
    target: 'SEATTLE',
    targetPos: { lng: -122.333, lat: 47.606 },
    spawnAt: SIM_EPOCH + 0 * SPAWN_STAGGER,
    trackSteps: 12,
  },
  {
    id: 'mon-2',
    codename: 'Vespyra',
    archetype: 'Tempest Wyrm',
    heightMeters: 98,
    weightTons: 41000,
    speedKmh: 62.0,
    submerged: false,
    spawn: { lng: -122.540, lat: 47.560 },
    target: 'BELLEVUE',
    targetPos: { lng: -122.200, lat: 47.610 },
    spawnAt: SIM_EPOCH + 1 * SPAWN_STAGGER,
    trackSteps: 14,
  },
  {
    id: 'mon-3',
    codename: 'Terrakon',
    archetype: 'Tectonic Behemoth',
    heightMeters: 120,
    weightTons: 67000,
    speedKmh: 22.5,
    submerged: false,
    spawn: { lng: -122.420, lat: 47.540 },
    target: 'MERCER ISLAND',
    targetPos: { lng: -122.225, lat: 47.585 },
    spawnAt: SIM_EPOCH + 2 * SPAWN_STAGGER,
    trackSteps: 11,
  },
  {
    id: 'mon-4',
    codename: 'Nyxmora',
    archetype: 'Umbral Leviathan',
    heightMeters: 155,
    weightTons: 73000,
    speedKmh: 48.0,
    submerged: true,
    spawn: { lng: -122.320, lat: 47.730 },
    target: 'KIRKLAND',
    targetPos: { lng: -122.210, lat: 47.678 },
    spawnAt: SIM_EPOCH + 3 * SPAWN_STAGGER,
    trackSteps: 13,
  },
  {
    id: 'mon-5',
    codename: 'Skarnyx',
    archetype: 'Brine Serpent',
    heightMeters: 88,
    weightTons: 29000,
    speedKmh: 55.0,
    submerged: true,
    spawn: { lng: -122.560, lat: 47.700 },
    target: 'SEATTLE',
    targetPos: { lng: -122.340, lat: 47.610 },
    spawnAt: SIM_EPOCH + 4 * SPAWN_STAGGER,
    trackSteps: 15,
  },
  {
    id: 'mon-6',
    codename: 'Molvorak',
    archetype: 'Magma Wraith',
    heightMeters: 110,
    weightTons: 52000,
    speedKmh: 40.0,
    submerged: false,
    spawn: { lng: -122.150, lat: 47.500 },
    target: 'BELLEVUE',
    targetPos: { lng: -122.200, lat: 47.615 },
    spawnAt: SIM_EPOCH + 5 * SPAWN_STAGGER,
    trackSteps: 13,
  },
] as const
