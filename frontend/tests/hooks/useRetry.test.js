import { describe, expect, test, vi } from 'vitest'
import { act, renderHook } from '../support/render'
import { useRetry } from '@/hooks/useRetry'

describe('useRetry', () => {
  test('is retrying while the load runs and calls it once, however often retry is called', async () => {
    let finish
    const load = vi.fn(() => new Promise((resolve) => { finish = resolve }))
    const { result } = renderHook(() => useRetry(load))
    expect(result.current[1]).toBe(false)

    let first
    act(() => { first = result.current[0]() })
    expect(result.current[1]).toBe(true)
    await act(async () => { await result.current[0]() })
    expect(load).toHaveBeenCalledTimes(1)

    await act(async () => {
      finish()
      await first
    })

    expect(result.current[1]).toBe(false)
  })

  test('can be used again after the load is done', async () => {
    const load = vi.fn().mockResolvedValue()
    const { result } = renderHook(() => useRetry(load))

    await act(async () => { await result.current[0]() })
    await act(async () => { await result.current[0]() })

    expect(load).toHaveBeenCalledTimes(2)
    expect(result.current[1]).toBe(false)
  })
})
