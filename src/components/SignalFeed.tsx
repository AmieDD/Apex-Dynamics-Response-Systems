// Signal Feed: reverse-chronological INFO/WARN/OPS ticker. The feed prop is
// already capped and most-recent-first upstream. Severity is conveyed by both
// color and an explicit text tag. The scroll region is an aria-live polite
// region so assistive tech announces new entries without stealing focus.

import type { SignalEvent, SignalSeverity } from '../mock/types'

export interface SignalFeedProps {
  /** Rolling, capped Signal Feed (most recent first). */
  feed: SignalEvent[]
}

/** Severity accent colors. Pulled from theme tokens; never the only signal. */
const SEVERITY_COLOR: Record<SignalSeverity, string> = {
  INFO: 'rgb(var(--accent))',
  WARN: 'var(--threat-elevated)',
  OPS: 'var(--threat-dormant)',
  CRIT: 'var(--threat-critical)',
}

/** Formats epoch ms as a fixed-width HH:MM:SS string. */
function formatTime(epochMs: number): string {
  const d = new Date(epochMs)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function SignalFeed({ feed }: SignalFeedProps): React.JSX.Element {
  return (
    <section
      aria-label="Signal feed"
      className="flex h-full min-h-0 flex-col gap-2 rounded-md border border-border bg-surface-raised p-3"
    >
      <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] text-text-muted">
        Signal Feed
      </h2>

      <ul
        aria-live="polite"
        aria-relevant="additions"
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1"
      >
        {feed.map((event) => {
          const color = SEVERITY_COLOR[event.severity]
          return (
            <li
              key={event.id}
              className="flex items-start gap-2 border-b border-border/50 py-1 last:border-b-0"
            >
              <time
                className="shrink-0 font-mono text-[10px] tabular-nums text-text-muted"
                dateTime={new Date(event.timestamp).toISOString()}
              >
                {formatTime(event.timestamp)}
              </time>
              <span
                className="shrink-0 rounded-sm border px-1 py-px font-mono text-[9px] font-bold tracking-[0.12em]"
                style={{ color, borderColor: color }}
              >
                {event.severity}
              </span>
              <span className="flex-1 text-[11px] leading-snug text-text">
                {event.message}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
