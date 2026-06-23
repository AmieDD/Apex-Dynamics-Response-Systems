// @vitest-environment jsdom
//
// Render tests for the hidden Clipzilla easter egg in CommandMap. Clicking the
// invisible hotspot pinned over Redmond summons Clipzilla with a mood-matched
// quip that fades itself out after a few seconds. The full MapLibre canvas is
// mocked away (no WebGL in jsdom) down to lightweight stand-ins for Map/Marker/
// Source/Layer — enough to exercise the click, the quip-bank selection, and the
// auto-dismiss timer. Math.random is pinned to 0 so each summon draws the first
// line of its bank, and matchMedia reports reduced motion so the per-frame
// advance loop stays frozen and deterministic.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import CommandMap, { type CommandMapProps } from './CommandMap'
import type { ThreatLevel } from '../mock/severity'
import { isWebglAvailable } from '../isWebglAvailable'

// WebGL detection is mocked: jsdom has no WebGL context so the real probe always
// returns false, which would force every test down the no-map fallback path.
// Default it to true here (the live-map path) and flip it per test when the
// fallback itself is under test.
vi.mock('../isWebglAvailable', () => ({
  isWebglAvailable: vi.fn(() => true),
}))

// Lightweight stand-ins for the react-map-gl/maplibre primitives. Marker wires
// its onClick to a synthetic event carrying the originalEvent.stopPropagation
// the component calls, so a click on the inner button reaches the handler.
vi.mock('react-map-gl/maplibre', () => ({
  Map: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  Marker: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode
    onClick?: (e: { originalEvent: { stopPropagation: () => void } }) => void
  }) => (
    <div
      onClick={
        onClick
          ? () => onClick({ originalEvent: { stopPropagation: () => {} } })
          : undefined
      }
    >
      {children}
    </div>
  ),
  Source: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Layer: () => null,
}))

/** Auto-dismiss window the component waits before fading the quip out (ms). */
const EGG_DURATION_MS = 5000

/** First line of each quip bank (Math.random pinned to 0 draws index 0). */
const CALM_FIRST = 'It looks like you\u2019re fighting a kaiju. Want some help with that?'
const HIGH_FIRST =
  'It looks like things are getting Critical. Want me to clip these jets together?'
const ALERT_FIRST =
  'CITYWIDE ALERT! It looks like you\u2019re evacuating everyone. I\u2019ll get the door.'

/** Accessible label on the invisible Redmond hotspot button. */
const HOTSPOT_LABEL = 'Redmond — summon Clipzilla'

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  // Default to the live-map path; the fallback test overrides this to false.
  vi.mocked(isWebglAvailable).mockReturnValue(true)
  // Report reduced motion so CommandMap freezes its requestAnimationFrame
  // advance loop, keeping the test fast and deterministic.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })),
  )
})

afterEach(() => {
  cleanup()
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Renders CommandMap with inert props plus the threat/alert state under test. */
function renderEgg(
  overrides: Partial<Pick<CommandMapProps, 'threatLevel' | 'alertActive'>> = {},
): void {
  const props: CommandMapProps = {
    leviathans: [],
    selectedId: null,
    select: vi.fn(),
    threatLevel: 'Dormant' as ThreatLevel,
    alertActive: false,
    reportLandfall: vi.fn(),
    reportStatus: vi.fn(),
    reportRange: vi.fn(),
    ...overrides,
  }
  render(<CommandMap {...props} />)
}

/** Clicks the invisible Redmond hotspot to summon Clipzilla. */
function summon(): void {
  fireEvent.click(screen.getByLabelText(HOTSPOT_LABEL))
}

describe('CommandMap Clipzilla easter egg', () => {
  it('stays dormant until the Redmond hotspot is clicked', () => {
    renderEgg()

    expect(screen.getByLabelText(HOTSPOT_LABEL)).toBeTruthy()
    expect(screen.queryByText(CALM_FIRST)).toBeNull()
  })

  it('summons a calm quip at low threat with no active alert', () => {
    renderEgg({ threatLevel: 'Dormant', alertActive: false })

    summon()

    expect(screen.getByText(CALM_FIRST)).toBeTruthy()
  })

  it('escalates to the high-threat bank at Critical', () => {
    renderEgg({ threatLevel: 'Critical', alertActive: false })

    summon()

    expect(screen.getByText(HIGH_FIRST)).toBeTruthy()
    expect(screen.queryByText(CALM_FIRST)).toBeNull()
  })

  it('uses the alert bank when a citywide alert outranks threat level', () => {
    renderEgg({ threatLevel: 'Dormant', alertActive: true })

    summon()

    expect(screen.getByText(ALERT_FIRST)).toBeTruthy()
  })

  it('fades the quip out after the auto-dismiss window', () => {
    renderEgg()

    summon()
    expect(screen.getByText(CALM_FIRST)).toBeTruthy()

    // Just shy of the window: the quip is still up.
    act(() => {
      vi.advanceTimersByTime(EGG_DURATION_MS - 1)
    })
    expect(screen.getByText(CALM_FIRST)).toBeTruthy()

    // Past the window: it dismisses itself.
    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(screen.queryByText(CALM_FIRST)).toBeNull()
  })

  it('drops to a no-map fallback that still summons Clipzilla without WebGL', () => {
    // No WebGL context available: the live MapLibre canvas can never mount.
    vi.mocked(isWebglAvailable).mockReturnValue(false)

    renderEgg()

    // The mocked Map is gone, replaced by an accessible status explaining why.
    expect(screen.queryByTestId('map')).toBeNull()
    expect(screen.getByText(/WebGL/i)).toBeTruthy()

    // The Redmond hotspot remains reachable and still summons Clipzilla.
    expect(screen.getByLabelText(HOTSPOT_LABEL)).toBeTruthy()
    summon()
    expect(screen.getByText(CALM_FIRST)).toBeTruthy()
  })
})
