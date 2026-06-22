// Unit tests for the Clipzilla easter-egg quip banks. Pure data + selection
// logic, no DOM — the component render test (CommandMap.test.tsx) still covers
// the click/summon/fade wiring; this exercises the mood-bank precedence and the
// content invariants directly. Node env.

import { afterEach, describe, expect, it, vi } from 'vitest'

import { CLIPZILLA_QUIPS, clipzillaQuipBank, pickQuip } from './clipzilla'
import { THREAT_LEVELS, threatRank, type ThreatLevel } from './severity'

describe('clipzillaQuipBank', () => {
  it('returns the calm bank when the situation is quiet', () => {
    expect(clipzillaQuipBank('Dormant', false)).toBe(CLIPZILLA_QUIPS.calm)
    expect(clipzillaQuipBank('Elevated', false)).toBe(CLIPZILLA_QUIPS.calm)
  })

  it('escalates to the high bank at Critical and above', () => {
    expect(clipzillaQuipBank('Critical', false)).toBe(CLIPZILLA_QUIPS.high)
    expect(clipzillaQuipBank('Cataclysm', false)).toBe(CLIPZILLA_QUIPS.high)
  })

  it('lets an active alert outrank every threat level', () => {
    for (const level of THREAT_LEVELS) {
      expect(clipzillaQuipBank(level, true)).toBe(CLIPZILLA_QUIPS.alert)
    }
  })

  it('switches from calm to high exactly at the Critical rank boundary', () => {
    const boundary = threatRank('Critical')
    for (const level of THREAT_LEVELS) {
      const expected =
        threatRank(level) >= boundary ? CLIPZILLA_QUIPS.high : CLIPZILLA_QUIPS.calm
      expect(clipzillaQuipBank(level as ThreatLevel, false)).toBe(expected)
    }
  })
})

describe('CLIPZILLA_QUIPS content', () => {
  it('has at least one non-empty line in every bank', () => {
    for (const bank of Object.values(CLIPZILLA_QUIPS)) {
      expect(bank.length).toBeGreaterThan(0)
      for (const line of bank) {
        expect(line.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('keeps every quip distinct within its bank', () => {
    for (const bank of Object.values(CLIPZILLA_QUIPS)) {
      expect(new Set(bank).size).toBe(bank.length)
    }
  })
})

describe('pickQuip', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('draws the random-indexed line when there is no previous quip', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(pickQuip(CLIPZILLA_QUIPS.calm)).toBe(CLIPZILLA_QUIPS.calm[0])
  })

  it('never returns the previous line on a back-to-back draw', () => {
    const bank = CLIPZILLA_QUIPS.calm
    // Walk Math.random across every index; with the first line excluded the
    // picker must skip it for all of them.
    for (let i = 0; i < bank.length; i++) {
      vi.spyOn(Math, 'random').mockReturnValue(i / bank.length)
      expect(pickQuip(bank, bank[0])).not.toBe(bank[0])
      vi.restoreAllMocks()
    }
  })

  it('selects from the remaining lines after excluding the previous one', () => {
    const bank = CLIPZILLA_QUIPS.high
    // Exclude index 0, then pin random to 0 -> first of the remaining lines.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(pickQuip(bank, bank[0])).toBe(bank[1])
  })

  it('returns the only line when the bank has a single entry', () => {
    expect(pickQuip(['solo'], 'solo')).toBe('solo')
  })

  it('ignores a previous line that is not in the bank', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(pickQuip(CLIPZILLA_QUIPS.calm, 'not-in-this-bank')).toBe(
      CLIPZILLA_QUIPS.calm[0],
    )
  })
})

