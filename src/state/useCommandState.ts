// Centralized live state for the Kaiju Defense Network command center.
//
// A single 1000ms interval drives the wall clock and roster ticks; a separate
// Poisson-like scheduler feeds the Signal Feed. Threat condition/level are
// derived from the highest-severity active leviathan. Dispatch and alert
// actions append Signal Feed entries. Timers that drive animated content
// (the feed) are throttled when the user prefers reduced motion.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  appendCapped,
  makeSignalEvent,
  scheduleNext,
} from '../mock/feed'
import { createRoster, tickLeviathans } from '../mock/leviathans'
import { maxThreat, threatRank, type ThreatLevel } from '../mock/severity'
import type { DispatchUnit, Leviathan, SignalEvent } from '../mock/types'

/** Initial dispatch assets and their capacities. */
const INITIAL_DISPATCH: readonly DispatchUnit[] = [
  { name: 'Scramble Jets', available: 6, capacity: 6 },
  { name: 'Deploy Mechs', available: 4, capacity: 4 },
  { name: 'Raise Barrier', available: 3, capacity: 3 },
  { name: 'Evac Sector', available: 8, capacity: 8 },
] as const

/** A leviathan is "active" while it is not yet contained. */
function isActive(lev: Leviathan): boolean {
  return lev.status !== 'CONTAINED'
}

/** Highest threat across active leviathans (defaults to Dormant when calm). */
function deriveThreatLevel(leviathans: readonly Leviathan[]): ThreatLevel {
  return leviathans
    .filter(isActive)
    .reduce<ThreatLevel>((acc, lev) => maxThreat(acc, lev.threat), 'Dormant')
}

/** Detects the user's reduced-motion preference (SSR/test-safe). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export interface CommandState {
  /** Current wall-clock time (epoch ms), updated every second. */
  now: number
  /** Live leviathan roster. */
  leviathans: Leviathan[]
  /** Currently selected leviathan id, or null. */
  selectedId: string | null
  /** Selects (or clears) the focused leviathan. */
  select: (id: string | null) => void
  /** Rolling, capped Signal Feed (most recent first). */
  feed: SignalEvent[]
  /** Dispatch assets and remaining capacities. */
  dispatch: DispatchUnit[]
  /** Numeric threat condition code (1 = Dormant ... 5 = Cataclysm). */
  threatCondition: number
  /** Highest active threat level on the Dormant -> Cataclysm scale. */
  threatLevel: ThreatLevel
  /** Whether a citywide alert is currently active. */
  alertActive: boolean
  /** Activates/clears the citywide alert and logs to the feed. */
  triggerAlert: (active?: boolean) => void
  /** Deploys one unit of the named asset (decrements capacity, logs to feed). */
  dispatchUnit: (name: string) => void
}

export function useCommandState(): CommandState {
  const [now, setNow] = useState<number>(() => Date.now())
  const [leviathans, setLeviathans] = useState<Leviathan[]>(() => createRoster())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [feed, setFeed] = useState<SignalEvent[]>([])
  const [dispatch, setDispatch] = useState<DispatchUnit[]>(() => [...INITIAL_DISPATCH])
  const [alertActive, setAlertActive] = useState<boolean>(false)

  // Latest roster snapshot for the feed scheduler closure to read fresh data.
  const leviathansRef = useRef<Leviathan[]>(leviathans)
  useEffect(() => {
    leviathansRef.current = leviathans
  }, [leviathans])

  const pushEvent = useCallback((event: SignalEvent): void => {
    setFeed((prev) => appendCapped(prev, event))
  }, [])

  // 1000ms heartbeat: advance the clock and drift the roster.
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
      setLeviathans((prev) => tickLeviathans(prev))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Poisson-like Signal Feed. Throttle the arrival rate under reduced motion.
  useEffect(() => {
    const ratePerMin = prefersReducedMotion() ? 6 : 24
    const cancel = scheduleNext(() => {
      pushEvent(makeSignalEvent(leviathansRef.current))
    }, ratePerMin)
    return cancel
  }, [pushEvent])

  const select = useCallback((id: string | null): void => {
    setSelectedId(id)
  }, [])

  const triggerAlert = useCallback(
    (active = true): void => {
      setAlertActive(active)
      pushEvent({
        ...makeSignalEvent(leviathansRef.current),
        severity: active ? 'WARN' : 'OPS',
        message: active
          ? 'CITYWIDE ALERT RAISED — all sectors to shelter posture.'
          : 'Citywide alert stood down — sectors returning to nominal.',
        timestamp: Date.now(),
      })
    },
    [pushEvent],
  )

  const dispatchUnit = useCallback(
    (name: string): void => {
      setDispatch((prev) => {
        const unit = prev.find((u) => u.name === name)
        if (!unit || unit.available <= 0) {
          pushEvent({
            ...makeSignalEvent(leviathansRef.current),
            severity: 'WARN',
            message: `Dispatch denied: ${name} at zero capacity.`,
            timestamp: Date.now(),
          })
          return prev
        }
        pushEvent({
          ...makeSignalEvent(leviathansRef.current),
          severity: 'OPS',
          message: `Dispatch confirmed: ${name} deployed (${unit.available - 1}/${unit.capacity} remaining).`,
          timestamp: Date.now(),
        })
        return prev.map((u) =>
          u.name === name ? { ...u, available: u.available - 1 } : u,
        )
      })
    },
    [pushEvent],
  )

  const threatLevel = useMemo(() => deriveThreatLevel(leviathans), [leviathans])
  const threatCondition = useMemo(() => threatRank(threatLevel) + 1, [threatLevel])

  return {
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
  }
}
