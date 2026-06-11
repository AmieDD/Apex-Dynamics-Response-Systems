// Active Leviathans roster: selectable cards bound to the live roster. Each
// card surfaces class numeral, archetype, key telemetry, status, and an HP bar
// tinted by the leviathan's threat level (color paired with a text label).

import {
  threatColor,
  threatLabel,
  type ThreatLevel,
} from '../mock/severity'
import type { Leviathan } from '../mock/types'

export interface LeviathanRosterProps {
  /** Live leviathan roster. */
  leviathans: Leviathan[]
  /** Currently selected leviathan id, or null. */
  selectedId: string | null
  /** Selects (or clears) the focused leviathan. */
  onSelect: (id: string | null) => void
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex flex-col leading-tight">
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-text-muted">
        {label}
      </span>
      <span className="font-mono text-xs tabular-nums text-text">{value}</span>
    </div>
  )
}

function LeviathanCard({
  leviathan,
  selected,
  onSelect,
}: {
  leviathan: Leviathan
  selected: boolean
  onSelect: (id: string | null) => void
}): React.JSX.Element {
  const threat: ThreatLevel = leviathan.threat
  const accent = threatColor(threat)
  const hpRatio = leviathan.hpMax > 0 ? leviathan.hp / leviathan.hpMax : 0
  const hpPct = Math.max(0, Math.min(100, Math.round(hpRatio * 100)))

  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(selected ? null : leviathan.id)}
        className="w-full rounded-sm border bg-surface px-3 py-2.5 text-left transition-colors hover:border-accent/60"
        style={{
          borderColor: selected ? accent : 'rgb(var(--border))',
          boxShadow: selected ? `inset 0 0 0 1px ${accent}` : undefined,
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-text">{leviathan.codename}</span>
            <span className="text-[11px] text-text-muted">{leviathan.archetype}</span>
          </div>
          <span
            className="shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.15em]"
            style={{ color: accent, borderColor: accent }}
          >
            CLS {leviathan.classNumeral}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-4 gap-2">
          <Stat label="Range" value={`${Math.round(leviathan.range)}km`} />
          <Stat label="Height" value={`${Math.round(leviathan.height)}m`} />
          <Stat label="Speed" value={`${Math.round(leviathan.speed)}km/h`} />
          <Stat label="Status" value={leviathan.status} />
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={leviathan.hpMax}
            aria-valuenow={Math.round(leviathan.hp)}
            aria-label={`Hit points: ${hpPct}% — threat ${threatLabel(threat)}`}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${hpPct}%`, backgroundColor: accent }}
            />
          </div>
          <span
            className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: accent }}
          >
            HP {threatLabel(threat)}
          </span>
        </div>
      </button>
    </li>
  )
}

export function LeviathanRoster({
  leviathans,
  selectedId,
  onSelect,
}: LeviathanRosterProps): React.JSX.Element {
  return (
    <section
      aria-label="Active leviathans"
      className="flex h-full min-h-0 flex-col gap-2 rounded-md border border-border bg-surface-raised p-3"
    >
      <header className="flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] text-text-muted">
          Active Leviathans
        </h2>
        <span className="font-mono text-xs tabular-nums text-text-muted">
          {leviathans.length}
        </span>
      </header>

      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {leviathans.map((leviathan) => (
          <LeviathanCard
            key={leviathan.id}
            leviathan={leviathan}
            selected={leviathan.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </section>
  )
}
