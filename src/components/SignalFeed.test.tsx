// @vitest-environment jsdom
//
// Render tests for the signal feed ticker. SignalFeed is presentational and
// renders events in the order given (the caller supplies them newest-first).
// These assert that order is preserved, each entry carries its severity tag
// and accent color, the timestamp surfaces a machine-readable dateTime, and an
// empty feed renders an empty list.

import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { SignalEvent } from '../mock/types'
import { SignalFeed } from './SignalFeed'

afterEach(cleanup)

const FEED: SignalEvent[] = [
  { id: 'sig-3', severity: 'OPS', message: 'Sector 7 holding.', timestamp: 3_000 },
  { id: 'sig-2', severity: 'WARN', message: 'Anomaly off the coast.', timestamp: 2_000 },
  { id: 'sig-1', severity: 'INFO', message: 'Sensors nominal.', timestamp: 1_000 },
]

describe('SignalFeed', () => {
  it('renders events in the order supplied (newest first)', () => {
    render(<SignalFeed feed={FEED} />)

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0].textContent).toContain('Sector 7 holding.')
    expect(items[1].textContent).toContain('Anomaly off the coast.')
    expect(items[2].textContent).toContain('Sensors nominal.')
  })

  it('tags each entry with its severity', () => {
    render(<SignalFeed feed={FEED} />)

    const items = screen.getAllByRole('listitem')
    expect(within(items[0]).getByText('OPS')).toBeTruthy()
    expect(within(items[1]).getByText('WARN')).toBeTruthy()
    expect(within(items[2]).getByText('INFO')).toBeTruthy()
  })

  it('colors the severity tag from the theme token', () => {
    render(<SignalFeed feed={FEED} />)

    const warnTag = screen.getByText('WARN')
    expect(warnTag.style.color).toBe('var(--threat-elevated)')
    expect(warnTag.style.borderColor).toBe('var(--threat-elevated)')
  })

  it('surfaces a machine-readable timestamp', () => {
    render(<SignalFeed feed={FEED} />)

    const time = within(screen.getAllByRole('listitem')[0]).getByText(
      /^\d{2}:\d{2}:\d{2}$/,
    )
    expect(time.getAttribute('dateTime')).toBe(new Date(3_000).toISOString())
  })

  it('announces additions through a polite live region', () => {
    render(<SignalFeed feed={FEED} />)

    const list = screen.getByRole('list')
    expect(list.getAttribute('aria-live')).toBe('polite')
  })

  it('renders an empty list when the feed is empty', () => {
    render(<SignalFeed feed={[]} />)

    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByRole('list')).toBeTruthy()
  })
})
