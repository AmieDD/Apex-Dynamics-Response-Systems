// @vitest-environment jsdom
//
// Render tests for MapErrorBoundary. The boundary guards the code-split command
// map: it passes children through normally and swaps in a fallback panel when a
// child throws during render (the chunk-load / render-throw recovery path). A
// throwing child component exercises the catch; React + componentDidCatch both
// log to console.error on a caught throw, so that's silenced per-test to keep
// the suite output clean while still asserting the recovered UI.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MapErrorBoundary } from './MapErrorBoundary'

/** Child that throws on render to trip the boundary. */
function Boom(): React.JSX.Element {
  throw new Error('map chunk failed')
}

afterEach(() => {
  cleanup()
})

describe('MapErrorBoundary', () => {
  it('renders children when no error is thrown', () => {
    render(
      <MapErrorBoundary>
        <span>tactical map online</span>
      </MapErrorBoundary>,
    )

    expect(screen.getByText('tactical map online')).toBeTruthy()
    // No alert role while children render normally.
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renders the default fallback when a child throws', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <MapErrorBoundary>
        <Boom />
      </MapErrorBoundary>,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toBeTruthy()
    expect(alert.textContent).toContain('Tactical map offline')

    errorSpy.mockRestore()
  })

  it('renders a custom fallback when one is provided', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <MapErrorBoundary fallback={<span>custom map fallback</span>}>
        <Boom />
      </MapErrorBoundary>,
    )

    expect(screen.getByText('custom map fallback')).toBeTruthy()

    errorSpy.mockRestore()
  })
})
