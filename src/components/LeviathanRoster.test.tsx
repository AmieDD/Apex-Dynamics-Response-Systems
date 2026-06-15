// @vitest-environment jsdom
//
// Tests for the roster's keyboard selection path. LeviathanRoster is a
// controlled component (selection lives in the parent), so these assert the
// onSelect callback the keyboard handler fires for each key, with the supplied
// selectedId standing in for "current". Arrow keys wrap-cycle the roster and
// Escape clears it.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRoster } from '../mock/leviathans'
import { LeviathanRoster } from './LeviathanRoster'

const ROSTER = createRoster()
const FIRST = ROSTER[0].id
const LAST = ROSTER[ROSTER.length - 1].id

afterEach(cleanup)

/** Renders the roster with a spy onSelect and returns the list element + spy. */
function renderRoster(selectedId: string | null) {
  const onSelect = vi.fn()
  render(
    <LeviathanRoster
      leviathans={ROSTER}
      selectedId={selectedId}
      onSelect={onSelect}
    />,
  )
  return { list: screen.getByRole('list'), onSelect }
}

describe('LeviathanRoster keyboard selection', () => {
  it('ArrowDown with nothing selected selects the first leviathan', () => {
    const { list, onSelect } = renderRoster(null)

    fireEvent.keyDown(list, { key: 'ArrowDown' })

    expect(onSelect).toHaveBeenCalledWith(FIRST)
  })

  it('ArrowUp with nothing selected selects the last leviathan', () => {
    const { list, onSelect } = renderRoster(null)

    fireEvent.keyDown(list, { key: 'ArrowUp' })

    expect(onSelect).toHaveBeenCalledWith(LAST)
  })

  it('ArrowDown advances to the next leviathan', () => {
    const { list, onSelect } = renderRoster(FIRST)

    fireEvent.keyDown(list, { key: 'ArrowDown' })

    expect(onSelect).toHaveBeenCalledWith(ROSTER[1].id)
  })

  it('ArrowDown wraps from the last leviathan back to the first', () => {
    const { list, onSelect } = renderRoster(LAST)

    fireEvent.keyDown(list, { key: 'ArrowDown' })

    expect(onSelect).toHaveBeenCalledWith(FIRST)
  })

  it('ArrowUp wraps from the first leviathan to the last', () => {
    const { list, onSelect } = renderRoster(FIRST)

    fireEvent.keyDown(list, { key: 'ArrowUp' })

    expect(onSelect).toHaveBeenCalledWith(LAST)
  })

  it('Escape clears the selection', () => {
    const { list, onSelect } = renderRoster(FIRST)

    fireEvent.keyDown(list, { key: 'Escape' })

    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('ignores other keys', () => {
    const { list, onSelect } = renderRoster(FIRST)

    fireEvent.keyDown(list, { key: 'Enter' })
    fireEvent.keyDown(list, { key: 'a' })

    expect(onSelect).not.toHaveBeenCalled()
  })
})
