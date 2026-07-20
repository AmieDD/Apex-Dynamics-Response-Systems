// Active Leviathans roster: selectable cards bound to the live roster. Each
// card surfaces class numeral, archetype, key telemetry, status, and an HP bar
// tinted by the leviathan's threat level (color paired with a text label).

import { etaToLandfall, formatEta } from '../mock/leviathans'
import {
  threatColor,
  threatLabel,
  type ThreatLevel,
} from '../mock/severity'
import type { Leviathan, LeviathanStatus } from '../mock/types'

/** Proximity-urgency tint for each inbound status band. Reuses the threat
    palette as a shared urgency vocabulary; the status text label always rides
    alongside the color so it is never the only signal. */
const STATUS_BAND_COLOR: Record<LeviathanStatus, string> = {
  SUBMERGED: 'rgb(var(--text-muted))',
  INBOUND: 'var(--threat-stirring)',
  SURFACED: 'var(--threat-elevated)',
  LANDFALL: 'var(--threat-critical)',
  CONTAINED: 'var(--threat-dormant)',
}

export interface LeviathanRosterProps {
  /** Live leviathan roster. */
  leviathans: Leviathan[]
  /** Currently selected leviathan id, or null. */
  selectedId: string | null
  /** Selects (or clears) the focused leviathan. */
  onSelect: (id: string | null) => void
}

function Stat({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  /** Optional inline tint for the value (e.g. the status-band color). */
  valueColor?: string
}): React.JSX.Element {
  return (
    <div className="flex flex-col leading-tight">
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-text-muted">
        {label}
      </span>
      <span
        className="font-mono text-xs tabular-nums text-text"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </span>
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
  const band = STATUS_BAND_COLOR[leviathan.status]
  // Time-to-landfall the inbound track already implies, surfaced as a readout
  // alongside the remaining range; a dispatch visibly pushes this back.
  const eta = formatEta(etaToLandfall(leviathan.range, leviathan.speed))
  const hpRatio = leviathan.hpMax > 0 ? leviathan.hp / leviathan.hpMax : 0
  const hpPct = Math.max(0, Math.min(100, Math.round(hpRatio * 100)))
  // A dispatch shoves the targeted leviathan back; `repel` decays each
  // heartbeat, so this briefly flashes the card to echo the map's REPELLED
  // flag, then clears itself.
  const repelled = leviathan.repel > 0.001

  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(selected ? null : leviathan.id)}
        className={`w-full rounded-sm border bg-surface px-3 py-2.5 text-left transition-colors hover:border-accent/60${
          repelled ? ' kdn-roster-card--repelled' : ''
        }`}
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

        <div className="mt-2 grid grid-cols-5 gap-2">
          <Stat label="To Target" value={`${Math.round(leviathan.range)}km`} valueColor={band} />
          <Stat label="ETA" value={eta} valueColor={band} />
          <Stat label="Height" value={`${Math.round(leviathan.height)}m`} />
          <Stat label="Speed" value={`${Math.round(leviathan.speed)}km/h`} />
          <Stat label="Status" value={leviathan.status} valueColor={band} />
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
  // Arrow keys cycle the selection through the roster (wrapping at the ends);
  // Escape clears it. Focus follows the selection to the matching card so the
  // keyboard path mirrors the visual one without a separate roving tabindex.
  function handleKeyDown(event: React.KeyboardEvent<HTMLUListElement>): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Escape') {
      return
    }
    event.preventDefault()

    if (event.key === 'Escape') {
      onSelect(null)
      return
    }
    if (leviathans.length === 0) return

    const delta = event.key === 'ArrowDown' ? 1 : -1
    const current = leviathans.findIndex((lev) => lev.id === selectedId)
    const nextIndex =
      current === -1
        ? delta === 1
          ? 0
          : leviathans.length - 1
        : (current + delta + leviathans.length) % leviathans.length

    onSelect(leviathans[nextIndex].id)
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>(
      ':scope > li > button',
    )
    buttons[nextIndex]?.focus()
  }

  return (
    <section
      aria-label="Active leviathans"
      className="flex h-full min-h-0 flex-col gap-2 rounded-md border border-border bg-surface-raised p-3"
    >
      <header className="flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] text-text-muted">
          Active Leviathans
        </h2>
        <span className="flex items-baseline gap-2 font-mono text-[9px] uppercase tracking-[0.15em] text-text-muted">
          <span aria-hidden="true">↑↓ select · esc clear</span>
          <span className="tabular-nums">{leviathans.length}</span>
        </span>
      </header>

      <ul
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1"
        onKeyDown={handleKeyDown}
      >
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
