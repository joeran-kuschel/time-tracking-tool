import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useElapsedTime } from './useElapsedTime'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-21T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useElapsedTime', () => {
  test('shows 00:00:00 without a start time', () => {
    const { result } = renderHook(() => useElapsedTime(null))
    expect(result.current).toBe('00:00:00')
  })

  test('counts from the given start time, e.g. after a reload', () => {
    const { result } = renderHook(() => useElapsedTime('2026-09-21T08:58:57Z'))
    expect(result.current).toBe('01:01:03')
  })

  test('updates every second', () => {
    const { result } = renderHook(() => useElapsedTime('2026-09-21T10:00:00Z'))
    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current).toBe('00:00:02')
  })

  test('never shows negative time when clocks differ', () => {
    const { result } = renderHook(() => useElapsedTime('2026-09-21T10:00:05Z'))
    expect(result.current).toBe('00:00:00')
  })
})
