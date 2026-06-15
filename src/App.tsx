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

import CommandMap from './components/CommandMap'
import { DispatchPanel } from './components/DispatchPanel'
import { LastStandScene } from './components/LastStandScene'
import { LeviathanRoster } from './components/LeviathanRoster'
import { SignalFeed } from './components/SignalFeed'
import { ThreatCondition } from './components/ThreatCondition'
import { TopBar } from './components/TopBar'
import { TriggerAlertBar } from './components/TriggerAlertBar'
import { useCommandState } from './state/useCommandState'

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
      <TopBar now={now} threatLevel={threatLevel} />

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
          <CommandMap
            leviathans={leviathans}
            selectedId={selectedId}
            select={select}
            alertActive={alertActive}
            reportLandfall={reportLandfall}
            reportStatus={reportStatus}
            reportRange={reportRange}
          />
          <LastStandScene />
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
