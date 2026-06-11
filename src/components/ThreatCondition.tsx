// Vertical DEFCON-style threat-condition ladder. The active level is rendered
// with full color and a marker; the rest are dimmed. Color is never the only
// signal — every rung is labeled and the active rung is flagged explicitly.

import {
  THREAT_LEVELS,
  threatColor,
  threatLabel,
  threatRank,
  type ThreatLevel,
} from '../mock/severity'

export interface ThreatConditionProps {
  /** Numeric threat condition code (1 = Dormant ... 5 = Cataclysm). */
  threatCondition: number
  /** Highest active threat level on the Dormant -> Cataclysm scale. */
  threatLevel: ThreatLevel
}

export function ThreatCondition({
  threatCondition,
  threatLevel,
}: ThreatConditionProps): React.JSX.Element {
  return (
    <section
      aria-label="Threat condition ladder"
      className="flex h-full flex-col gap-2 rounded-md border border-border bg-surface-raised p-3"
    >
      <header className="flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] text-text-muted">
          Threat Condition
        </h2>
        <span className="font-mono text-sm font-bold tabular-nums text-text">
          {threatCondition}
        </span>
      </header>

      <ol className="flex flex-1 flex-col gap-1.5">
        {THREAT_LEVELS.map((level) => {
          const isActive = level === threatLevel
          const code = threatRank(level) + 1
          const color = threatColor(level)

          return (
            <li
              key={level}
              aria-current={isActive ? 'true' : undefined}
              className="flex items-center gap-2 rounded-sm border px-2 py-1.5 transition-colors"
              style={{
                borderColor: isActive ? color : 'rgb(var(--border))',
                backgroundColor: isActive ? `${color}1f` : 'transparent',
                opacity: isActive ? 1 : 0.45,
              }}
            >
              <span
                aria-hidden="true"
                className="h-3 w-1.5 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span
                className="font-mono text-xs font-bold tabular-nums"
                style={{ color: isActive ? color : 'rgb(var(--text-muted))' }}
              >
                {code}
              </span>
              <span
                className="flex-1 font-mono text-xs font-semibold uppercase tracking-[0.12em]"
                style={{ color: isActive ? 'rgb(var(--text))' : 'rgb(var(--text-muted))' }}
              >
                {threatLabel(level)}
              </span>
              {isActive ? (
                <span
                  className="font-mono text-[9px] font-bold uppercase tracking-[0.2em]"
                  style={{ color }}
                >
                  Active
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
