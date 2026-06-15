// @vitest-environment jsdom
//
// Render tests for the dispatch panel. DispatchPanel is presentational, so
// these assert the capacity guard: a unit with remaining capacity shows a
// "Deploy" button that fires onDispatch with the unit name, a depleted unit
// disables its button and labels it "Depleted", and the target readout and
// capacity progressbar surface their props.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DispatchUnit } from '../mock/types'
import { DispatchPanel } from './DispatchPanel'

afterEach(cleanup)

const DISPATCH: DispatchUnit[] = [
  { name: 'Scramble Jets', available: 6, capacity: 6 },
  { name: 'Raise Barrier', available: 0, capacity: 3 },
]

function row(name: string): HTMLElement {
  return screen.getByText(name).closest('li') as HTMLElement
}

describe('DispatchPanel', () => {
  it('deploys an available unit by name when its button is clicked', () => {
    const onDispatch = vi.fn()
    render(<DispatchPanel dispatch={DISPATCH} onDispatch={onDispatch} />)

    const button = within(row('Scramble Jets')).getByRole<HTMLButtonElement>(
      'button',
    )
    expect(button.disabled).toBe(false)
    expect(button.textContent).toBe('Deploy')

    fireEvent.click(button)

    expect(onDispatch).toHaveBeenCalledTimes(1)
    expect(onDispatch).toHaveBeenCalledWith('Scramble Jets')
  })

  it('disables a depleted unit and labels it Depleted', () => {
    const onDispatch = vi.fn()
    render(<DispatchPanel dispatch={DISPATCH} onDispatch={onDispatch} />)

    const button = within(row('Raise Barrier')).getByRole<HTMLButtonElement>(
      'button',
    )
    expect(button.disabled).toBe(true)
    expect(button.textContent).toBe('Depleted')

    fireEvent.click(button)

    expect(onDispatch).not.toHaveBeenCalled()
  })

  it('reports remaining capacity on the progressbar', () => {
    const onDispatch = vi.fn()
    render(<DispatchPanel dispatch={DISPATCH} onDispatch={onDispatch} />)

    const bar = within(row('Scramble Jets')).getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('6')
    expect(bar.getAttribute('aria-valuemax')).toBe('6')

    expect(
      within(row('Raise Barrier')).getByLabelText('0 of 3 available'),
    ).toBeTruthy()
  })

  it('surfaces the targeted codename in the header', () => {
    render(
      <DispatchPanel
        dispatch={DISPATCH}
        onDispatch={vi.fn()}
        targetCodename="Gorathos"
      />,
    )

    expect(screen.getByText('Target ▸ Gorathos')).toBeTruthy()
  })

  it('shows no target when none is selected', () => {
    render(<DispatchPanel dispatch={DISPATCH} onDispatch={vi.fn()} />)

    expect(screen.getByText('Target ▸ none')).toBeTruthy()
  })
})
