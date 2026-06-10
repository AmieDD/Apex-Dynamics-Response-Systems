// Threat severity scale for the Kaiju Defense Network.
//
// The hex values here mirror the CSS variables in src/styles/tokens.css and
// must stay in sync. A text label is always available so color is never the
// only signal that conveys severity (accessibility: DR-04).

export type ThreatLevel =
  | 'Dormant'
  | 'Stirring'
  | 'Elevated'
  | 'Critical'
  | 'Cataclysm'

/** Ordered low -> high. Index doubles as the numeric severity rank. */
export const THREAT_LEVELS: readonly ThreatLevel[] = [
  'Dormant',
  'Stirring',
  'Elevated',
  'Critical',
  'Cataclysm',
] as const

const THREAT_HEX: Record<ThreatLevel, string> = {
  Dormant: '#10b981',
  Stirring: '#facc15',
  Elevated: '#f97316',
  Critical: '#ef4444',
  Cataclysm: '#b91c1c',
}

const THREAT_CSS_VAR: Record<ThreatLevel, string> = {
  Dormant: 'var(--threat-dormant)',
  Stirring: 'var(--threat-stirring)',
  Elevated: 'var(--threat-elevated)',
  Critical: 'var(--threat-critical)',
  Cataclysm: 'var(--threat-cataclysm)',
}

const THREAT_LABEL: Record<ThreatLevel, string> = {
  Dormant: 'DORMANT',
  Stirring: 'STIRRING',
  Elevated: 'ELEVATED',
  Critical: 'CRITICAL',
  Cataclysm: 'CATACLYSM',
}

/** Hex color for direct use in inline styles and the MapLibre canvas. */
export function threatColor(level: ThreatLevel): string {
  return THREAT_HEX[level]
}

/** CSS-variable reference for use within stylesheet-driven contexts. */
export function threatColorVar(level: ThreatLevel): string {
  return THREAT_CSS_VAR[level]
}

/** Uppercase text label so color is never the only severity signal. */
export function threatLabel(level: ThreatLevel): string {
  return THREAT_LABEL[level]
}

/** Numeric rank (0 = Dormant ... 4 = Cataclysm) for comparison/derivation. */
export function threatRank(level: ThreatLevel): number {
  return THREAT_LEVELS.indexOf(level)
}

/** Returns the higher-severity of two threat levels. */
export function maxThreat(a: ThreatLevel, b: ThreatLevel): ThreatLevel {
  return threatRank(a) >= threatRank(b) ? a : b
}
