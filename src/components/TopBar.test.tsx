// @vitest-environment jsdom
//
// Render tests for the command-center top bar. TopBar is presentational, so
// these assert that each prop surfaces: the wall clock (deterministic via the
// <time> dateTime attribute, since the displayed text is timezone-local), the
// THREATCON number with its accessible label, the threat-level badge, and the
// Clipzilla mascot.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { TopBar } from './TopBar'

afterEach(cleanup)

describe('TopBar', () => {
  it('renders the wall clock with a UTC machine-readable timestamp', () => {
    const epoch = Date.UTC(2026, 5, 15, 9, 30, 0)
    render(
      <TopBar
        now={epoch}
        threatCondition={4}
        threatLevel="Critical"
        alertActive={false}
      />,
    )

    const time = document.querySelector('time')
    expect(time).not.toBeNull()
    expect(time?.getAttribute('dateTime')).toBe(new Date(epoch).toISOString())
    expect(time?.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })

  it('surfaces the THREATCON number with an accessible label', () => {
    render(
      <TopBar now={0} threatCondition={4} threatLevel="Critical" alertActive={false} />,
    )

    const threatcon = screen.getByLabelText('Threat condition 4 of 5')
    expect(threatcon.textContent).toBe('4')
  })

  it('shows the threat level label', () => {
    render(
      <TopBar now={0} threatCondition={2} threatLevel="Stirring" alertActive={false} />,
    )

    expect(screen.getByText('STIRRING')).toBeTruthy()
  })

  it('renders the Clipzilla mascot', () => {
    render(
      <TopBar now={0} threatCondition={1} threatLevel="Dormant" alertActive={false} />,
    )

    const mascot = screen.getByRole('img')
    expect(mascot.getAttribute('alt')).toContain('Clipzilla')
  })

  it('falls back to the network title', () => {
    render(
      <TopBar now={0} threatCondition={1} threatLevel="Dormant" alertActive={false} />,
    )

    expect(screen.getByRole('heading').textContent).toBe('KAIJU DEFENSE NETWORK')
  })
})
