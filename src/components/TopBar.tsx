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

/** Self-contained kaiju badge shown if a Clipzilla pose fails to load, so the
 *  brand mark degrades gracefully instead of a broken-image glyph. Inlined as a
 *  data URI — no extra network request and no dependency on a real file. */
const MASCOT_FALLBACK = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none">` +
    `<path d="M11 12 8 5 15 10Z" fill="#e6edf3"/>` +
    `<path d="M29 12 32 5 25 10Z" fill="#e6edf3"/>` +
    `<ellipse cx="20" cy="22" rx="13" ry="12" fill="#863bff"/>` +
    `<circle cx="15" cy="20" r="3.5" fill="#fff"/>` +
    `<circle cx="25" cy="20" r="3.5" fill="#fff"/>` +
    `<circle cx="15" cy="20.5" r="1.6" fill="#0d1117"/>` +
    `<circle cx="25" cy="20.5" r="1.6" fill="#0d1117"/>` +
    `<path d="M15 28Q20 32 25 28" stroke="#0d1117" stroke-width="1.5" stroke-linecap="round"/>` +
    `</svg>`,
)}`

/** Picks the Clipzilla pose from command-center state. An active citywide alert
 *  takes precedence over threat level, so the beacon always shows during an
 *  alert; otherwise Critical/Cataclysm shows the charging pose and calmer
 *  levels show the default happy mascot. `ringColor` is the threat hue to frame
 *  the mascot with during high-threat/alert states (null = calm, neutral). */
function mascotPose(
  threatLevel: ThreatLevel,
  alertActive: boolean,
): { src: string; alt: string; alarm: boolean; ringColor: string | null } {
  if (alertActive) {
    return {
      src: '/ClipzillaAlarm.png',
      alt: 'Clipzilla raising an alert beacon — citywide alert active',
      alarm: true,
      ringColor: threatColor('Critical'),
    }
  }
  if (threatRank(threatLevel) >= threatRank('Critical')) {
    return {
      src: '/ClipzillaAngry.png',
      alt: `Clipzilla on the offensive — ${threatLabel(threatLevel)} threat`,
      alarm: false,
      ringColor: threatColor(threatLevel),
    }
  }
  return {
    src: '/Clipzilla.png',
    alt: 'Clipzilla — Apex Dynamics mascot',
    alarm: false,
    ringColor: null,
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
          onError={(e) => {
            // Swap to the inline badge once; clearing onerror prevents a loop
            // if the fallback itself ever fails.
            const img = e.currentTarget
            if (img.src !== MASCOT_FALLBACK) {
              img.onerror = null
              img.src = MASCOT_FALLBACK
            }
          }}
          className={`kdn-mascot h-10 w-10 shrink-0 rounded-md border bg-surface object-contain${
            mascot.ringColor ? '' : ' border-border'
          }${mascot.alarm ? ' kdn-mascot--alarm' : ''}`}
          style={
            mascot.ringColor
              ? {
                  borderColor: mascot.ringColor,
                  boxShadow: `0 0 0 2px ${mascot.ringColor}, 0 0 10px ${mascot.ringColor}80`,
                }
              : undefined
          }
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
