// Command-center top bar: live wall clock + color-coded Threat Level badge.
// Presentational only — receives its slice of state via props so App can compose it.

import { threatColor, threatLabel, threatRank, type ThreatLevel } from '../mock/severity'

export interface TopBarProps {
  /** Current wall-clock time (epoch ms), updated every second by the parent. */
  now: number
  /** Highest active threat level on the Dormant -> Cataclysm scale. */
  threatLevel: ThreatLevel
  /** Whether a citywide alert is active; drives the mascot's alert pose. */
  alertActive: boolean
  /** Optional headline; defaults to the network name. */
  title?: string
}

/** Formats epoch ms as a fixed-width HH:MM:SS string. */
function formatClock(epochMs: number): string {
  const d = new Date(epochMs)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

/** Picks the Clipzilla pose from command-center state. An active citywide alert
 *  takes precedence over threat level, so the beacon always shows during an
 *  alert; otherwise Critical/Cataclysm shows the charging pose and calmer
 *  levels show the default happy mascot. */
function mascotPose(
  threatLevel: ThreatLevel,
  alertActive: boolean,
): { src: string; alt: string; alarm: boolean } {
  if (alertActive) {
    return {
      src: '/ClipzillaAlarm.png',
      alt: 'Clipzilla raising an alert beacon — citywide alert active',
      alarm: true,
    }
  }
  if (threatRank(threatLevel) >= threatRank('Critical')) {
    return {
      src: '/ClipzillaAngry.png',
      alt: `Clipzilla on the offensive — ${threatLabel(threatLevel)} threat`,
      alarm: false,
    }
  }
  return {
    src: '/Clipzilla.png',
    alt: 'Clipzilla — Apex Dynamics mascot',
    alarm: false,
  }
}

export function TopBar({
  now,
  threatLevel,
  alertActive,
  title = 'KAIJU DEFENSE NETWORK',
}: TopBarProps): React.JSX.Element {
  const color = threatColor(threatLevel)
  const mascot = mascotPose(threatLevel, alertActive)

  return (
    <header className="kdn-topbar flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex items-center gap-3">
        <img
          key={mascot.src}
          src={mascot.src}
          alt={mascot.alt}
          title="Clipzilla"
          width={40}
          height={40}
          className={`kdn-mascot h-10 w-10 shrink-0 rounded-md border border-border bg-surface object-contain${
            mascot.alarm ? ' kdn-mascot--alarm' : ''
          }`}
        />
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-text-muted">
            APEX DYNAMICS
          </span>
          <h1 className="text-sm font-semibold uppercase tracking-[0.18em] text-text">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end leading-none">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-text-muted">
            Time
          </span>
          <time
            className="font-mono text-xl font-medium tabular-nums text-text"
            dateTime={new Date(now).toISOString()}
          >
            {formatClock(now)}
          </time>
        </div>

        <div className="flex flex-col items-end leading-none">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-text-muted">
            Threat Level
          </span>
          <span
            className="mt-1 inline-flex items-center gap-2 rounded-sm border px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-[0.18em]"
            style={{
              color,
              borderColor: color,
              backgroundColor: `${color}1a`,
            }}
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            {threatLabel(threatLevel)}
          </span>
        </div>
      </div>
    </header>
  )
}
