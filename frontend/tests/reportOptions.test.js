import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { saveShowAmounts, storedShowAmounts } from '@/reportOptions'

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('reportOptions', () => {
  test('shows no amounts until the choice was saved', () => {
    expect(storedShowAmounts()).toBe(false)
  })

  test('remembers the choice', () => {
    saveShowAmounts(true)
    expect(storedShowAmounts()).toBe(true)
    expect(window.localStorage.getItem('reportAmounts')).toBe('true')

    saveShowAmounts(false)
    expect(storedShowAmounts()).toBe(false)
  })

  test('treats anything but "true" as off', () => {
    window.localStorage.setItem('reportAmounts', '1')
    expect(storedShowAmounts()).toBe(false)
  })

  test('works when the browser blocks its storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })

    expect(() => saveShowAmounts(true)).not.toThrow()
    expect(storedShowAmounts()).toBe(false)
  })
})
