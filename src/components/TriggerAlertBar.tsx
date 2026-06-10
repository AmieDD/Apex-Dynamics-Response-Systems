// Trigger Citywide Alert bar: a deliberately friction-laden primary action.
// A quick single click never fires. With motion enabled the operator must
// press and hold (~1.5s) while a progress meter fills; under reduced-motion
// the control falls back to an explicit two-step arm/confirm. This is the only
// panel that owns timers, by design.

import { useCallback, useEffect, useRef, useState } from 'react'

/** Hold duration before the alert action commits, in milliseconds. */
const HOLD_MS = 1500

export interface TriggerAlertBarProps {
  /** Whether a citywide alert is currently active. */
  alertActive: boolean
  /** Activates/clears the citywide alert. */
  onTrigger: (active?: boolean) => void
}

/** Detects the user's reduced-motion preference (SSR/test-safe). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function TriggerAlertBar({
  alertActive,
  onTrigger,
}: TriggerAlertBarProps): React.JSX.Element {
  const reducedMotion = prefersReducedMotion()

  // Hold-to-confirm progress (0..1) and the active animation frame / start time.
  const [progress, setProgress] = useState<number>(0)
  // Reduced-motion fallback: whether the action is armed awaiting confirmation.
  const [armed, setArmed] = useState<boolean>(false)

  const frameRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)

  const accent = alertActive ? 'var(--threat-dormant)' : 'var(--threat-critical)'
  const label = alertActive ? 'Stand Down Alert' : 'Trigger Citywide Alert'

  const cancelHold = useCallback((): void => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    setProgress(0)
  }, [])

  useEffect(() => cancelHold, [cancelHold])

  const commit = useCallback((): void => {
    onTrigger(!alertActive)
  }, [onTrigger, alertActive])

  const startHold = useCallback((): void => {
    if (frameRef.current !== null) return
    startRef.current = performance.now()
    const step = (ts: number): void => {
      const elapsed = ts - startRef.current
      const next = Math.min(1, elapsed / HOLD_MS)
      setProgress(next)
      if (next >= 1) {
        frameRef.current = null
        setProgress(0)
        commit()
        return
      }
      frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
  }, [commit])

  // Reduced-motion path: explicit two-step arm -> confirm.
  if (reducedMotion) {
    return (
      <section
        aria-label="Trigger citywide alert"
        className="rounded-md border border-border bg-surface-raised p-3"
      >
        {armed ? (
          <div className="flex items-center gap-2">
            <span className="flex-1 font-mono text-xs uppercase tracking-[0.15em] text-text">
              Confirm: {label}?
            </span>
            <button
              type="button"
              onClick={() => {
                setArmed(false)
                commit()
              }}
              className="rounded-sm border px-3 py-2 text-xs font-bold uppercase tracking-[0.15em]"
              style={{ color: accent, borderColor: accent }}
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setArmed(false)}
              className="rounded-sm border border-border px-3 py-2 text-xs font-bold uppercase tracking-[0.15em] text-text-muted"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setArmed(true)}
            className="w-full rounded-sm border px-3 py-3 text-sm font-bold uppercase tracking-[0.2em]"
            style={{ color: accent, borderColor: accent, backgroundColor: `${alertActive ? '#10b981' : '#ef4444'}1a` }}
          >
            {label}
          </button>
        )}
      </section>
    )
  }

  // Default path: press-and-hold with a filling progress meter.
  return (
    <section
      aria-label="Trigger citywide alert"
      className="rounded-md border border-border bg-surface-raised p-3"
    >
      <button
        type="button"
        aria-pressed={alertActive}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        className="relative w-full select-none overflow-hidden rounded-sm border px-3 py-3 text-sm font-bold uppercase tracking-[0.2em] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={{
          color: accent,
          borderColor: accent,
          backgroundColor: `${alertActive ? '#10b981' : '#ef4444'}1a`,
        }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0"
          style={{ width: `${progress * 100}%`, backgroundColor: `${alertActive ? '#10b981' : '#ef4444'}33` }}
        />
        <span className="relative">
          {progress > 0 ? `Hold to confirm… ${Math.round(progress * 100)}%` : label}
        </span>
      </button>
      <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
        Press and hold to confirm
      </p>
    </section>
  )
}
