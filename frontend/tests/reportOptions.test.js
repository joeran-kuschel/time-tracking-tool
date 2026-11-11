import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { forgetStoredShowAmounts } from '@/reportOptions'

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('reportOptions', () => {
  test('removes the choice the browser used to remember and leaves other keys alone', () => {
    window.localStorage.setItem('reportAmounts', 'true')
    window.localStorage.setItem('language', 'de')

    forgetStoredShowAmounts()

    expect(window.localStorage.getItem('reportAmounts')).toBeNull()
    expect(window.localStorage.getItem('language')).toBe('de')
  })

  test('does nothing when there is nothing to remove', () => {
    expect(() => forgetStoredShowAmounts()).not.toThrow()
  })

  test('works when the browser blocks its storage', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked') })

    expect(() => forgetStoredShowAmounts()).not.toThrow()
  })
})
