// Mocked Last-Stand scenario cities for the command map's corner inset.
//
// Two Puget Sound cities the forced save-1-of-2 decision dramatizes. The
// populations are mocked. Kept here (not inline in LastStandScene) so the set
// can be locked to the Seattle region by a test, mirroring the leviathan
// roster's geography guard.

/** A city in the Last-Stand scenario, keyed by which field side it sits on. */
export interface LastStandCity {
  /** Display name (uppercase). */
  name: string
  /** Field side the city is rendered on. */
  side: 'left' | 'right'
  /** Mocked resident count. */
  population: number
}

/** The two cities in the scenario, by field side. Populations are mocked. */
export const LAST_STAND_CITIES: readonly LastStandCity[] = [
  { name: 'BREMERTON', side: 'left', population: 412000 },
  { name: 'OLYMPIA', side: 'right', population: 318000 },
] as const
