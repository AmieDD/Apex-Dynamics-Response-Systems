// Dispatch panel: one action row per response asset. Each row shows remaining
// capacity, a progress indicator, and a deploy button that calls onDispatch.
// Buttons disable at zero capacity. Presentational — no timers or state here.

import type { DispatchUnit } from '../mock/types'

export interface DispatchPanelProps {
  /** Dispatch assets and remaining capacities. */
  dispatch: DispatchUnit[]
  /** Deploys one unit of the named asset. */
  onDispatch: (name: string) => void
}

export function DispatchPanel({
  dispatch,
  onDispatch,
}: DispatchPanelProps): React.JSX.Element {
  return (
    <section
      aria-label="Dispatch assets"
      className="flex h-full flex-col gap-2 rounded-md border border-border bg-surface-raised p-3"
    >
      <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] text-text-muted">
        Dispatch
      </h2>

      <ul className="flex flex-1 flex-col gap-2">
        {dispatch.map((unit) => {
          const depleted = unit.available <= 0
          const ratio = unit.capacity > 0 ? unit.available / unit.capacity : 0
          const pct = Math.round(ratio * 100)

          return (
            <li
              key={unit.name}
              className="flex flex-col gap-1.5 rounded-sm border border-border bg-surface px-2.5 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-text">
                  {unit.name}
                </span>
                <span
                  className="font-mono text-xs tabular-nums text-text-muted"
                  aria-label={`${unit.available} of ${unit.capacity} available`}
                >
                  {unit.available}/{unit.capacity}
                </span>
              </div>

              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-border"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={unit.capacity}
                aria-valuenow={unit.available}
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <button
                type="button"
                disabled={depleted}
                onClick={() => onDispatch(unit.name)}
                className="mt-0.5 rounded-sm border border-accent/60 bg-accent/10 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-text-muted"
              >
                {depleted ? 'Depleted' : 'Deploy'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
