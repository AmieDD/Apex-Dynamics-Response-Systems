// Command-center composition root. Owns the single `useCommandState()` call and
// arranges every panel plus the map hero on a full-viewport CSS grid:
//
//   ┌──────────────────────── TopBar ────────────────────────┐
//   │ left rail │            CommandMap            │ right rail │
//   └──────────────────── TriggerAlertBar ───────────────────┘
//
// The middle band is the only flexible row (1fr) so the map hero resolves a
// definite height for its `h-full` MapLibre container. Side rails carry their
// own `min-h-0` panels so the roster and feed scroll regions engage.

import { lazy, Suspense } from 'react'

import { DispatchPanel } from './components/DispatchPanel'
import { LeviathanRoster } from './components/LeviathanRoster'
import { SignalFeed } from './components/SignalFeed'
import { ThreatCondition } from './components/ThreatCondition'
import { TopBar } from './components/TopBar'
import { TriggerAlertBar } from './components/TriggerAlertBar'
import { useCommandState } from './state/useCommandState'

// The command map pulls in react-map-gl + maplibre-gl (the app's heaviest
// dependency by far). Code-split it so the dashboard shell — top bar, rails,
// dispatch, feed — paints and becomes interactive while the map chunk streams
// in behind a calm placeholder, instead of blocking first paint on MapLibre.
const CommandMap = lazy(() => import('./components/CommandMap'))

// The last-stand scenario is a secondary corner inset over the map; defer it so
// it rides its own chunk rather than the initial shell. It carries a named
// export, so adapt it to the default-export shape lazy() expects.
const LastStandScene = lazy(() =>
  import('./components/LastStandScene').then((m) => ({ default: m.LastStandScene })),
)

/** Lightweight stand-in shown while the code-split MapLibre chunk loads. Fills
 *  the hero with a calm dark field and a status line so the layout never jumps
 *  when the map streams in. */
function MapLoadingPlaceholder(): React.JSX.Element {
  return (
    <div
      className="absolute inset-0 grid place-items-center bg-surface"
      role="status"
      aria-live="polite"
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-text-muted">
        Acquiring tactical map…
      </span>
    </div>
  )
}

function App(): React.JSX.Element {
  const {
    now,
    leviathans,
    selectedId,
    select,
    feed,
    dispatch,
    threatCondition,
    threatLevel,
    alertActive,
    triggerAlert,
    dispatchUnit,
    reportLandfall,
    reportStatus,
    reportRange,
  } = useCommandState()

  // The focused leviathan a dispatch will repel (null clears the target).
  const selectedLeviathan =
    leviathans.find((lev) => lev.id === selectedId) ?? null

  return (
    <div className="grid h-screen grid-rows-[auto_minmax(0,1fr)_auto] bg-surface text-text">
      <TopBar
        now={now}
        threatCondition={threatCondition}
        threatLevel={threatLevel}
        alertActive={alertActive}
      />

      <main className="grid min-h-0 grid-cols-1 gap-3 p-3 lg:grid-cols-[clamp(15rem,20vw,18rem)_minmax(0,1fr)_clamp(18rem,24vw,22rem)]">
        {/* Left rail: threat ladder + dispatch assets. */}
        <div className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto">
          <ThreatCondition
            threatCondition={threatCondition}
            threatLevel={threatLevel}
          />
          <DispatchPanel
            dispatch={dispatch}
            onDispatch={dispatchUnit}
            targetCodename={selectedLeviathan?.codename ?? null}
          />
        </div>

        {/* Center: command map hero with the last-stand scenario as a
            top-left corner mini-map inset over the map. */}
        <div className="relative min-h-[20rem] overflow-hidden rounded-md border border-border lg:min-h-0">
          <Suspense fallback={<MapLoadingPlaceholder />}>
            <CommandMap
              leviathans={leviathans}
              selectedId={selectedId}
              select={select}
              threatLevel={threatLevel}
              alertActive={alertActive}
              reportLandfall={reportLandfall}
              reportStatus={reportStatus}
              reportRange={reportRange}
            />
          </Suspense>
          <Suspense fallback={null}>
            <LastStandScene />
          </Suspense>
        </div>

        {/* Right rail: active leviathans roster + signal feed. */}
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <div className="min-h-0">
            <LeviathanRoster
              leviathans={leviathans}
              selectedId={selectedId}
              onSelect={select}
            />
          </div>
          <div className="min-h-0">
            <SignalFeed feed={feed} />
          </div>
        </div>
      </main>

      <TriggerAlertBar alertActive={alertActive} onTrigger={triggerAlert} />
    </div>
  )
}

export default App
