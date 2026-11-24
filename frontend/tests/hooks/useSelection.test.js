import { describe, expect, test } from 'vitest'
import { act, renderHook } from '../support/render'
import { useSelection } from '@/hooks/useSelection'

describe('useSelection', () => {
  test('toggles an id on and off, and counts', () => {
    const { result } = renderHook(() => useSelection())

    act(() => result.current.toggle(3))
    expect(result.current.has(3)).toBe(true)
    expect(result.current.count).toBe(1)

    act(() => result.current.toggle(3))
    expect(result.current.has(3)).toBe(false)
    expect(result.current.count).toBe(0)
  })

  test('keeps the ids in the order they were selected', () => {
    const { result } = renderHook(() => useSelection())

    act(() => { result.current.toggle(5); result.current.toggle(2); result.current.toggle(9) })

    expect(result.current.ids).toEqual([5, 2, 9])
  })

  test('selects and unselects many at once, without doubling an id', () => {
    const { result } = renderHook(() => useSelection())
    act(() => result.current.toggle(2))

    act(() => result.current.setMany([1, 2, 3], true))
    expect(result.current.ids).toEqual([2, 1, 3])

    act(() => result.current.setMany([1, 2], false))
    expect(result.current.ids).toEqual([3])
  })

  test('clears, and keeps the same state when there is nothing to clear', () => {
    const { result } = renderHook(() => useSelection())
    const before = result.current

    act(() => result.current.clear())
    expect(result.current).toBe(before)

    act(() => result.current.toggle(1))
    act(() => result.current.clear())
    expect(result.current.ids).toEqual([])
  })

  test('keepOnly drops the ids that are gone, and keeps the same state when none is', () => {
    const { result } = renderHook(() => useSelection())
    act(() => result.current.setMany([1, 2, 3], true))

    act(() => result.current.keepOnly([2, 3, 4]))
    expect(result.current.ids).toEqual([2, 3])

    const before = result.current
    act(() => result.current.keepOnly([2, 3, 4]))
    expect(result.current).toBe(before)
  })
})
