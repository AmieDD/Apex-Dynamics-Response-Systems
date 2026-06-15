// Tests for the Poisson-like feed scheduler. scheduleNext draws each
// inter-arrival gap from an exponential distribution via Math.random, so we pin
// Math.random for a deterministic interval and drive setTimeout with fake
// timers. These assert the fire, the self-re-arm, and that cancel() stops the
// stream (both before and after the first fire). Pure timer logic, node env.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { scheduleNext } from './feed'

// With Math.random pinned to 0.5 and rate 60/min (0.001/ms), the interval is
// -ln(0.5) / 0.001 ≈ 693.1ms. We advance past that to trigger a fire.
const RATE_PER_MIN = 60
const INTERVAL_MS = Math.ceil(-Math.log(0.5) / (RATE_PER_MIN / 60_000))

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('scheduleNext', () => {
  it('fires the callback after the drawn interval', () => {
    const cb = vi.fn()
    const cancel = scheduleNext(cb, RATE_PER_MIN)

    expect(cb).not.toHaveBeenCalled()
    vi.advanceTimersByTime(INTERVAL_MS)
    expect(cb).toHaveBeenCalledTimes(1)

    cancel()
  })

  it('re-arms itself so the callback fires repeatedly', () => {
    const cb = vi.fn()
    const cancel = scheduleNext(cb, RATE_PER_MIN)

    vi.advanceTimersByTime(INTERVAL_MS * 3)
    expect(cb).toHaveBeenCalledTimes(3)

    cancel()
  })

  it('stops firing after cancel()', () => {
    const cb = vi.fn()
    const cancel = scheduleNext(cb, RATE_PER_MIN)

    vi.advanceTimersByTime(INTERVAL_MS)
    expect(cb).toHaveBeenCalledTimes(1)

    cancel()
    vi.advanceTimersByTime(INTERVAL_MS * 5)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('never fires when cancelled before the first interval', () => {
    const cb = vi.fn()
    const cancel = scheduleNext(cb, RATE_PER_MIN)

    cancel()
    vi.advanceTimersByTime(INTERVAL_MS * 5)
    expect(cb).not.toHaveBeenCalled()
  })
})
