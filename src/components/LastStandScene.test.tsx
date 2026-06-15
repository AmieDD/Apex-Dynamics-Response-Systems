// @vitest-environment jsdom
//
// Render tests for the Last-Stand inset. LastStandScene dramatizes a mocked AI
// agent making a forced save-1-of-2-cities call: the header/subtitle frame the
// decision, the field shows two cities (one SAVED, one SACRIFICED), and the
// footer narrates the agent's pick. The "decision" is a coin flip in
// chooseCityToSave(), so we pin Math.random for deterministic outcomes and
// drive the resolve timer with fake timers (jsdom has no matchMedia, so
// prefersReducedMotion() is false and the LS_RESOLVE_MS delay applies).

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LastStandScene } from './LastStandScene'

/** Run length used by the component before it resolves the outcome. */
const LS_RESOLVE_MS = 4600

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** Advance past the resolve delay inside act() so state updates flush. */
function resolveRun(): void {
  act(() => {
    vi.advanceTimersByTime(LS_RESOLVE_MS)
  })
}

describe('LastStandScene', () => {
  it('frames the panel as a mocked AI agent decision', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2) // saves NORTHPOINT
    render(<LastStandScene />)

    expect(
      screen.getByLabelText(
        'Last-stand scenario: mocked AI agent chooses one of two cities to save',
      ),
    ).toBeTruthy()
    expect(screen.getByText('AI AGENT · SINGLE-SAVE DECISION')).toBeTruthy()
    expect(screen.getByText('2 KAIJU · 2 CITIES · SAVE ONLY 1')).toBeTruthy()
  })

  it('shows the agent weighing targets and no verdict before it resolves', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2)
    render(<LastStandScene />)

    expect(screen.getByText('AGENT WEIGHING TARGETS…')).toBeTruthy()
    expect(screen.queryByText('SAVED')).toBeNull()
    expect(screen.queryByText('SACRIFICED')).toBeNull()
  })

  it('narrates the saved and sacrificed cities once resolved', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2) // saves NORTHPOINT
    render(<LastStandScene />)

    resolveRun()

    expect(
      screen.getByText('SAVED NORTHPOINT · SACRIFICED BAYRIDGE'),
    ).toBeTruthy()
    expect(screen.getByText('SAVED')).toBeTruthy()
    expect(screen.getByText('SACRIFICED')).toBeTruthy()
  })

  it('reflects the coin-flip outcome for the other city', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.8) // saves BAYRIDGE
    render(<LastStandScene />)

    resolveRun()

    expect(
      screen.getByText('SAVED BAYRIDGE · SACRIFICED NORTHPOINT'),
    ).toBeTruthy()
  })

  it('shows each city population at all times', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2)
    render(<LastStandScene />)

    // Populations are visible before the agent resolves.
    expect(screen.getByText('POP 412,000')).toBeTruthy()
    expect(screen.getByText('POP 318,000')).toBeTruthy()
  })

  it('reports the human and kaiju cost only once resolved', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2) // saves NORTHPOINT, loses BAYRIDGE
    render(<LastStandScene />)

    expect(
      screen.queryByText('318,000 LOST · 1 KAIJU LANDED · 1 REPELLED'),
    ).toBeNull()

    resolveRun()

    expect(
      screen.getByText('318,000 LOST · 1 KAIJU LANDED · 1 REPELLED'),
    ).toBeTruthy()
  })

  it('re-runs the decision when RE-RUN is pressed', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.2) // NORTHPOINT
    render(<LastStandScene />)
    resolveRun()
    expect(
      screen.getByText('SAVED NORTHPOINT · SACRIFICED BAYRIDGE'),
    ).toBeTruthy()

    random.mockReturnValue(0.8) // re-roll now saves BAYRIDGE
    fireEvent.click(screen.getByText('RE-RUN'))

    // Re-run returns to the pending state before resolving again.
    expect(screen.getByText('AGENT WEIGHING TARGETS…')).toBeTruthy()

    resolveRun()
    expect(
      screen.getByText('SAVED BAYRIDGE · SACRIFICED NORTHPOINT'),
    ).toBeTruthy()
  })
})
