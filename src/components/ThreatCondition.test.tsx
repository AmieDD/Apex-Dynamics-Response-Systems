// @vitest-environment jsdom
//
// Render tests for the DEFCON-style threat-condition ladder. ThreatCondition
// is presentational: it always lists all five rungs (Dormant -> Cataclysm),
// flags exactly one as active (aria-current + an "Active" badge + full
// opacity), dims the rest, and echoes the numeric code in the header.

import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { THREAT_LEVELS, threatLabel } from '../mock/severity'
import { ThreatCondition } from './ThreatCondition'

afterEach(cleanup)

describe('ThreatCondition', () => {
  it('renders all five rungs in Dormant -> Cataclysm order', () => {
    render(<ThreatCondition threatCondition={3} threatLevel="Elevated" />)

    const rungs = screen.getAllByRole('listitem')
    expect(rungs).toHaveLength(5)
    rungs.forEach((rung, i) => {
      expect(rung.textContent).toContain(threatLabel(THREAT_LEVELS[i]))
    })
  })

  it('flags exactly the active rung with aria-current and an Active badge', () => {
    render(<ThreatCondition threatCondition={4} threatLevel="Critical" />)

    const active = screen
      .getAllByRole('listitem')
      .filter((li) => li.getAttribute('aria-current') === 'true')
    expect(active).toHaveLength(1)
    expect(active[0].textContent).toContain('CRITICAL')
    expect(within(active[0]).getByText('Active')).toBeTruthy()
  })

  it('renders the active rung at full opacity and dims the others', () => {
    render(<ThreatCondition threatCondition={2} threatLevel="Stirring" />)

    for (const rung of screen.getAllByRole('listitem')) {
      const active = rung.getAttribute('aria-current') === 'true'
      expect(rung.style.opacity).toBe(active ? '1' : '0.45')
    }
  })

  it('moves the active flag when the level changes', () => {
    const { rerender } = render(
      <ThreatCondition threatCondition={1} threatLevel="Dormant" />,
    )
    expect(
      screen.getByText('DORMANT').closest('li')?.getAttribute('aria-current'),
    ).toBe('true')

    rerender(<ThreatCondition threatCondition={5} threatLevel="Cataclysm" />)
    expect(
      screen.getByText('DORMANT').closest('li')?.getAttribute('aria-current'),
    ).toBeNull()
    expect(
      screen.getByText('CATACLYSM').closest('li')?.getAttribute('aria-current'),
    ).toBe('true')
  })

  it('echoes the numeric threat-condition code in the header', () => {
    render(<ThreatCondition threatCondition={3} threatLevel="Elevated" />)

    // The <header> is nested in a <section>, so it is not a landmark; reach it
    // via the labelled section. Its trailing span carries the code.
    const panel = screen.getByLabelText('Threat condition ladder')
    const header = panel.querySelector('header') as HTMLElement
    expect(within(header).getByText('3')).toBeTruthy()
  })
})
