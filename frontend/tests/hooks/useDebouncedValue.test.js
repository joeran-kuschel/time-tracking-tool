import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook } from '../support/render'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useDebouncedValue', () => {
  test('starts with the value and follows changes after the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), { initialProps: { value: 'a' } })
    expect(result.current[0]).toBe('a')

    rerender({ value: 'ab' })
    act(() => vi.advanceTimersByTime(299))
    expect(result.current[0]).toBe('a')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current[0]).toBe('ab')
  })

  test('waits for the value to stay the same, so quick changes give one update', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), { initialProps: { value: '' } })

    for (const value of ['a', 'ab', 'abc']) {
      rerender({ value })
      act(() => vi.advanceTimersByTime(200))
    }
    expect(result.current[0]).toBe('')
    act(() => vi.advanceTimersByTime(100))
    expect(result.current[0]).toBe('abc')
  })

  test('applies a value at once through the second result', () => {
    const { result } = renderHook(() => useDebouncedValue('a', 300))

    act(() => result.current[1]('b'))

    expect(result.current[0]).toBe('b')
  })
})
