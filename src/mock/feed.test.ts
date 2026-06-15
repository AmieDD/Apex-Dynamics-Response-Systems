// Tests for the Signal Feed generator. The module is decorative but now fully
// deterministic: seedFeed() pins the seedrandom PRNG so makeSignalEvent emits a
// reproducible stream, which lets us assert exact shape and the severity /
// leviathan-link invariants without fighting random variance. These run under
// the default `node` environment (no DOM needed).

import { describe, expect, it, beforeEach } from 'vitest'

import {
  appendCapped,
  FEED_BUFFER_CAP,
  makeSignalEvent,
  seedFeed,
} from './feed'
import { createRoster } from './leviathans'
import type { SignalEvent } from './types'

const ROSTER = createRoster()
const SEVERITIES = new Set(['INFO', 'WARN', 'OPS'])

/** Builds a minimal feed event for buffer tests. */
function event(id: string): SignalEvent {
  return { id, severity: 'INFO', message: id, timestamp: 0 }
}

beforeEach(() => {
  seedFeed(1)
})

describe('makeSignalEvent', () => {
  it('passes the supplied timestamp straight through', () => {
    expect(makeSignalEvent(ROSTER, 12_345).timestamp).toBe(12_345)
  })

  it('produces a non-empty message and id', () => {
    const e = makeSignalEvent(ROSTER, 0)
    expect(e.id.length).toBeGreaterThan(0)
    expect(e.message.length).toBeGreaterThan(0)
  })

  it('is reproducible for a fixed seed', () => {
    seedFeed(7)
    const first = makeSignalEvent(ROSTER, 1_000)
    seedFeed(7)
    const second = makeSignalEvent(ROSTER, 1_000)
    expect(second).toEqual(first)
  })

  it('emits unique ids across a stream', () => {
    const ids = Array.from({ length: 50 }, () => makeSignalEvent(ROSTER, 0).id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only ever tags INFO, WARN, or OPS (never CRIT)', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(SEVERITIES.has(makeSignalEvent(ROSTER, 0).severity)).toBe(true)
    }
  })

  it('weights the stream toward INFO', () => {
    let info = 0
    const total = 300
    for (let i = 0; i < total; i += 1) {
      if (makeSignalEvent(ROSTER, 0).severity === 'INFO') info += 1
    }
    // INFO carries a 0.6 weight, so it is the clear plurality over this sample.
    expect(info).toBeGreaterThan(total / 2)
  })

  it('links only to leviathans in the supplied roster, naming them in the message', () => {
    for (let i = 0; i < 300; i += 1) {
      const e = makeSignalEvent(ROSTER, 0)
      if (e.leviathanId === undefined) continue
      const linked = ROSTER.find((lev) => lev.id === e.leviathanId)
      expect(linked).toBeDefined()
      expect(e.message).toContain(linked!.codename)
    }
  })

  it('never links a leviathan when the roster is empty', () => {
    for (let i = 0; i < 100; i += 1) {
      expect(makeSignalEvent([], 0).leviathanId).toBeUndefined()
    }
  })
})

describe('appendCapped', () => {
  it('prepends the newest event so the buffer is most-recent-first', () => {
    const next = appendCapped([event('a')], event('b'))
    expect(next.map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('does not mutate the input buffer', () => {
    const buffer = [event('a')]
    appendCapped(buffer, event('b'))
    expect(buffer.map((e) => e.id)).toEqual(['a'])
  })

  it('trims to the cap, dropping the oldest entries', () => {
    const full = Array.from({ length: 3 }, (_, i) => event(`old-${i}`))
    const next = appendCapped(full, event('new'), 3)
    expect(next).toHaveLength(3)
    expect(next[0].id).toBe('new')
    expect(next.map((e) => e.id)).not.toContain('old-2')
  })

  it('defaults to the module buffer cap', () => {
    const full = Array.from({ length: FEED_BUFFER_CAP }, (_, i) => event(`e-${i}`))
    const next = appendCapped(full, event('new'))
    expect(next).toHaveLength(FEED_BUFFER_CAP)
    expect(next[0].id).toBe('new')
  })
})
