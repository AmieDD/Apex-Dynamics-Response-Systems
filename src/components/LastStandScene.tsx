// Last-Stand mini-map: a compact, fully MOCKED scenario rendered as a corner
// inset over the command map. It dramatizes a forced-choice decision an AI
// agent would face — two kaiju attack two cities at once and only one city can
// be saved. Two cities sit on a gridlined field and a leviathan advances on
// each from opposite edges; every run the agent "picks" one city to save (its
// leviathan repelled before impact — node turns SAVED) and the other is
// sacrificed (its leviathan reaches the node — SACRIFICED). The "decision" is a
// bare coin flip in chooseCityToSave(): no criteria, scoring, or fairness — the
// exact seam where a real decision system (HVE Core) would plug in. The header,
// footer read-out, and node labels all surface the agent-decision framing so a
// viewer can tell what is being demonstrated.
//
// Motion is CSS-keyframe driven (the `.ls-*` rules in src/styles/tokens.css)
// and restarts by remounting the field on a `runId` key. The animation shape is
// identical every run; only the saved/lost assignment changes.
// prefers-reduced-motion resolves the outcome instantly with no travel.

import { useCallback, useEffect, useState } from 'react'

import { LAST_STAND_CITIES } from '../mock/lastStandCities'

/** The two cities in the scenario, by field side. Populations are mocked. */
const CITIES = LAST_STAND_CITIES

/** Total run length (ms); matches the `.ls-advance-*` keyframe durations. */
const LS_RESOLVE_MS = 4600

/** Population of a city by name (0 if unknown). */
function populationOf(city: string): number {
  return CITIES.find((c) => c.name === city)?.population ?? 0
}

/** Format a population count with thousands separators (e.g. 412,000). */
function formatPopulation(count: number): string {
  return count.toLocaleString('en-US')
}

/**
 * Arbitrarily pick which single city survives this run.
 *
 * A pure coin flip by design — no criteria, weighting, scoring, or rationale.
 * Do not add fairness or explanation here; this is the mocked decision seam.
 */
function chooseCityToSave(): string {
  return Math.random() < 0.5 ? 'BREMERTON' : 'OLYMPIA'
}

/** Detects the user's reduced-motion preference (SSR/test-safe). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Compact last-stand scenario inset for the command map's top-left corner. */
export function LastStandScene(): React.JSX.Element {
  const reducedMotion = prefersReducedMotion()
  const [runId, setRunId] = useState<number>(0)
  const [savedCity, setSavedCity] = useState<string>(() => chooseCityToSave())
  const [resolved, setResolved] = useState<boolean>(false)

  // Start a fresh run: re-roll the outcome and replay the advance.
  const startRun = useCallback((): void => {
    setSavedCity(chooseCityToSave())
    setResolved(false)
    setRunId((n) => n + 1)
  }, [])

  // Resolve once the leviathans finish advancing (instant under reduced motion).
  useEffect(() => {
    const delay = reducedMotion ? 0 : LS_RESOLVE_MS
    const timer = window.setTimeout(() => setResolved(true), delay)
    return () => window.clearTimeout(timer)
  }, [runId, reducedMotion])

  const lostCity = savedCity === 'BREMERTON' ? 'OLYMPIA' : 'BREMERTON'

  return (
    <section
      aria-label="Last-stand scenario: mocked AI agent chooses one of two cities to save"
      className="ls-panel"
    >
      <div className="ls-head">
        <div className="ls-head-text">
          <span className="ls-title">AI AGENT · SINGLE-SAVE DECISION</span>
          <span className="ls-sub">2 KAIJU · 2 CITIES · SAVE ONLY 1</span>
        </div>
      </div>

      {/* key={runId} restarts every CSS animation for a clean replay. */}
      <div className="ls-field" key={runId}>
        <div className="ls-gridlines" aria-hidden="true" />

        {CITIES.map((c) => {
          const state = !resolved
            ? 'pending'
            : c.name === savedCity
              ? 'protected'
              : 'overrun'
          return (
            <div key={c.name} className={`ls-city ${c.side} ${state}`}>
              <div className="ls-city-node" aria-hidden="true" />
              <div className="ls-city-name">{c.name}</div>
              <div className="ls-city-pop">
                POP {formatPopulation(c.population)}
              </div>
              <div className="ls-city-state">
                {state === 'protected'
                  ? 'SAVED'
                  : state === 'overrun'
                    ? 'SACRIFICED'
                    : '\u00A0'}
              </div>
              {c.name === savedCity && (
                <div className="ls-shield" aria-hidden="true" />
              )}
            </div>
          )
        })}

        {CITIES.map((c) => {
          const fate = c.name === savedCity ? 'repelled' : 'impact'
          return (
            <div key={`mon-${c.name}`} className={`ls-mon ${c.side} ${fate}`}>
              <span className="ls-mon-glyph" aria-hidden="true">
                ▲
              </span>
              <span className="ls-mon-tag">
                {c.side === 'left' ? 'KAIJU-α' : 'KAIJU-β'}
              </span>
            </div>
          )
        })}
      </div>

      <div className="ls-foot">
        <div className="ls-foot-text">
          <span
            aria-live="polite"
            className={`ls-outcome${resolved ? '' : ' pending'}`}
          >
            {resolved
              ? `SAVED ${savedCity} · SACRIFICED ${lostCity}`
              : 'AGENT WEIGHING TARGETS…'}
          </span>
          {resolved && (
            <span className="ls-cost">
              {formatPopulation(populationOf(lostCity))} LOST · 1 KAIJU LANDED ·
              1 REPELLED
            </span>
          )}
        </div>
        <button type="button" className="ls-btn" onClick={startRun}>
          RE-RUN
        </button>
      </div>
    </section>
  )
}
