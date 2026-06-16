// @vitest-environment jsdom
//
// Behavioral tests for the dispatch action in useCommandState. dispatchUnit is
// the most-iterated logic in the command center: it decrements asset capacity,
// shoves the *selected* leviathan back along its track (the repel knockback),
// caps stacked knockback, denies at zero capacity, and logs a deterministic
// Signal Feed entry. These run under fake timers so the 1s roster heartbeat and
// the Poisson feed scheduler never fire — keeping repel and the feed pristine
// for assertions.

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as feed from '../mock/feed'
import { REPEL_KNOCKBACK_FRAC, REPEL_KNOCKBACK_MAX } from '../mock/leviathans'
import { useCommandState } from './useCommandState'

/** Remaining capacity of a named dispatch asset in the current render. */
function capacityOf(
  result: { current: ReturnType<typeof useCommandState> },
  name: string,
): number {
  const unit = result.current.dispatch.find((u) => u.name === name)
  if (unit == null) throw new Error(`No dispatch asset named ${name}`)
  return unit.available
}

/** Current repel knockback for a leviathan by id. */
function repelOf(
  result: { current: ReturnType<typeof useCommandState> },
  id: string,
): number {
  const lev = result.current.leviathans.find((l) => l.id === id)
  if (lev == null) throw new Error(`No leviathan with id ${id}`)
  return lev.repel
}

beforeEach(() => {
  vi.useFakeTimers()
  feed.seedFeed(1)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('dispatchUnit', () => {
  it('decrements the asset capacity by one', () => {
    const { result } = renderHook(() => useCommandState())
    const before = capacityOf(result, 'Scramble Jets')

    act(() => result.current.dispatchUnit('Scramble Jets'))

    expect(capacityOf(result, 'Scramble Jets')).toBe(before - 1)
  })

  it('repels only the selected leviathan', () => {
    const { result } = renderHook(() => useCommandState())
    act(() => result.current.select('lev-1'))

    act(() => result.current.dispatchUnit('Scramble Jets'))

    expect(repelOf(result, 'lev-1')).toBeCloseTo(REPEL_KNOCKBACK_FRAC, 5)
    for (const lev of result.current.leviathans) {
      if (lev.id !== 'lev-1') expect(lev.repel).toBe(0)
    }
  })

  it('caps stacked knockback at the maximum', () => {
    const { result } = renderHook(() => useCommandState())
    act(() => result.current.select('lev-1'))

    // 0.18 x 4 = 0.72 would exceed the 0.6 cap; Scramble Jets has capacity 6.
    for (let i = 0; i < 4; i += 1) {
      act(() => result.current.dispatchUnit('Scramble Jets'))
    }

    expect(repelOf(result, 'lev-1')).toBeCloseTo(REPEL_KNOCKBACK_MAX, 5)
  })

  it('denies dispatch once an asset is exhausted', () => {
    const { result } = renderHook(() => useCommandState())
    const capacity = capacityOf(result, 'Raise Barrier')

    for (let i = 0; i < capacity; i += 1) {
      act(() => result.current.dispatchUnit('Raise Barrier'))
    }
    expect(capacityOf(result, 'Raise Barrier')).toBe(0)

    act(() => result.current.dispatchUnit('Raise Barrier'))

    expect(capacityOf(result, 'Raise Barrier')).toBe(0)
    expect(result.current.feed[0].severity).toBe('WARN')
    expect(result.current.feed[0].message).toBe(
      'Dispatch denied: Raise Barrier at zero capacity.',
    )
  })

  it('logs an engagement against the targeted leviathan', () => {
    const { result } = renderHook(() => useCommandState())
    act(() => result.current.select('lev-1'))
    const codename = result.current.leviathans.find((l) => l.id === 'lev-1')!
      .codename

    act(() => result.current.dispatchUnit('Scramble Jets'))

    const event = result.current.feed[0]
    expect(event.severity).toBe('OPS')
    expect(event.message).toBe(
      `Scramble Jets engaged ${codename.toUpperCase()} — repelled toward open water (5/6 remaining).`,
    )
  })

  it('logs an untargeted deployment and repels nothing when no leviathan is selected', () => {
    const { result } = renderHook(() => useCommandState())

    act(() => result.current.dispatchUnit('Evac Sector'))

    const event = result.current.feed[0]
    expect(event.severity).toBe('OPS')
    expect(event.message).toBe(
      'Dispatch confirmed: Evac Sector deployed (7/8 remaining).',
    )
    for (const lev of result.current.leviathans) {
      expect(lev.repel).toBe(0)
    }
  })
})

describe('reportStatus', () => {
  it('adopts the live inbound band the map reports', () => {
    const { result } = renderHook(() => useCommandState())

    // lev-1 (Gorathos) spawns LANDFALL; the map can report it back to INBOUND.
    act(() => result.current.reportStatus('lev-1', 'INBOUND'))

    const lev = result.current.leviathans.find((l) => l.id === 'lev-1')
    expect(lev?.status).toBe('INBOUND')
  })

  it('preserves the leviathan object identity when the status is unchanged', () => {
    const { result } = renderHook(() => useCommandState())
    const before = result.current.leviathans.find((l) => l.id === 'lev-1')!

    act(() => result.current.reportStatus('lev-1', before.status))

    const after = result.current.leviathans.find((l) => l.id === 'lev-1')!
    expect(after).toBe(before)
  })
})

describe('reportRange', () => {
  it('adopts the live remaining range the map reports', () => {
    const { result } = renderHook(() => useCommandState())

    act(() => result.current.reportRange('lev-1', 123))

    const lev = result.current.leviathans.find((l) => l.id === 'lev-1')
    expect(lev?.range).toBe(123)
  })

  it('preserves the leviathan object identity when the range is unchanged', () => {
    const { result } = renderHook(() => useCommandState())
    const before = result.current.leviathans.find((l) => l.id === 'lev-1')!

    act(() => result.current.reportRange('lev-1', before.range))

    const after = result.current.leviathans.find((l) => l.id === 'lev-1')!
    expect(after).toBe(before)
  })
})

describe('reportLandfall', () => {
  it('logs a CRIT landfall and track reacquisition', () => {
    const { result } = renderHook(() => useCommandState())

    act(() => result.current.reportLandfall('Gorathos', 'SEATTLE', 215))

    const event = result.current.feed[0]
    expect(event.severity).toBe('CRIT')
    expect(event.message).toBe(
      'GORATHOS reached landfall at SEATTLE — repelled. Track reacquired at 215km.',
    )
  })

  it('rounds the reacquired range in the readout', () => {
    const { result } = renderHook(() => useCommandState())

    act(() => result.current.reportLandfall('Vespyra', 'SEATTLE', 214.6))

    expect(result.current.feed[0].message).toContain('Track reacquired at 215km.')
  })

  it('leaves the roster untouched — landfall is a feed-only report', () => {
    const { result } = renderHook(() => useCommandState())
    const before = result.current.leviathans

    act(() => result.current.reportLandfall('Gorathos', 'SEATTLE', 215))

    expect(result.current.leviathans).toBe(before)
  })
})

describe('triggerAlert', () => {
  it('raises the citywide alert and logs a WARN to the feed', () => {
    const { result } = renderHook(() => useCommandState())

    act(() => result.current.triggerAlert())

    expect(result.current.alertActive).toBe(true)
    const event = result.current.feed[0]
    expect(event.severity).toBe('WARN')
    expect(event.message).toBe(
      'CITYWIDE ALERT RAISED — all sectors to shelter posture.',
    )
  })

  it('defaults to raising the alert when called with no argument', () => {
    const { result } = renderHook(() => useCommandState())

    act(() => result.current.triggerAlert())

    expect(result.current.alertActive).toBe(true)
  })

  it('stands the alert down and logs an OPS message', () => {
    const { result } = renderHook(() => useCommandState())

    act(() => result.current.triggerAlert(true))
    act(() => result.current.triggerAlert(false))

    expect(result.current.alertActive).toBe(false)
    const event = result.current.feed[0]
    expect(event.severity).toBe('OPS')
    expect(event.message).toBe(
      'Citywide alert stood down — sectors returning to nominal.',
    )
  })
})

describe('reduced-motion feed rate', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('feeds at the full rate when matchMedia is unavailable', () => {
    // jsdom omits matchMedia by default, so prefersReducedMotion() is false.
    const schedule = vi.spyOn(feed, 'scheduleNext').mockReturnValue(() => {})

    renderHook(() => useCommandState())

    expect(schedule).toHaveBeenCalledTimes(1)
    expect(schedule.mock.calls[0]?.[1]).toBe(24)
  })

  it('throttles the feed when the user prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    const schedule = vi.spyOn(feed, 'scheduleNext').mockReturnValue(() => {})

    renderHook(() => useCommandState())

    expect(schedule.mock.calls[0]?.[1]).toBe(6)
  })

  it('keeps the full rate when reduced motion is not requested', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    const schedule = vi.spyOn(feed, 'scheduleNext').mockReturnValue(() => {})

    renderHook(() => useCommandState())

    expect(schedule.mock.calls[0]?.[1]).toBe(24)
  })
})
