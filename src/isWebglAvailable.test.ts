// @vitest-environment jsdom
//
// Unit tests for the WebGL availability probe. Under jsdom `getContext` returns
// null for GL contexts, so we stub `HTMLCanvasElement.prototype.getContext` to
// drive each branch: a truthy context (supported), null (unsupported), and a
// throw (defensive guard). jsdom env (a real `document` is required).

import { afterEach, describe, expect, it, vi } from 'vitest'

import { isWebglAvailable } from './isWebglAvailable'

describe('isWebglAvailable', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true when getContext yields a truthy WebGL context', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as RenderingContext,
    )
    expect(isWebglAvailable()).toBe(true)
  })

  it('returns false when getContext returns null for every probe', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    expect(isWebglAvailable()).toBe(false)
  })

  it('returns false when getContext throws', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('context creation blew up')
    })
    expect(isWebglAvailable()).toBe(false)
  })
})
