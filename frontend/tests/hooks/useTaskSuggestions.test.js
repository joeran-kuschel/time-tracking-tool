import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook, waitFor } from '../support/render'
import { useTaskSuggestions } from '@/hooks/useTaskSuggestions'
import { api } from '@/api'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal()), api: { getTasks: vi.fn() } }))

beforeEach(() => {
  vi.resetAllMocks()
})

describe('useTaskSuggestions', () => {
  test('loads the tasks of the project', async () => {
    api.getTasks.mockResolvedValue(['Fix login', 'Review'])
    const { result } = renderHook(() => useTaskSuggestions(7))

    await waitFor(() => expect(result.current).toEqual(['Fix login', 'Review']))
    expect(api.getTasks).toHaveBeenCalledWith(7)
  })

  test('asks nothing without a project', () => {
    const { result } = renderHook(() => useTaskSuggestions(null))

    expect(result.current).toEqual([])
    expect(api.getTasks).not.toHaveBeenCalled()
  })

  test('loads again for another project and when the reload key changes', async () => {
    api.getTasks.mockResolvedValueOnce(['A']).mockResolvedValueOnce(['B']).mockResolvedValueOnce(['B', 'C'])
    const { result, rerender } = renderHook(({ id, key }) => useTaskSuggestions(id, key), { initialProps: { id: 7, key: 0 } })
    await waitFor(() => expect(result.current).toEqual(['A']))

    rerender({ id: 8, key: 0 })
    await waitFor(() => expect(result.current).toEqual(['B']))

    rerender({ id: 8, key: 1 })
    await waitFor(() => expect(result.current).toEqual(['B', 'C']))
  })

  test('shows no suggestions and no error when the request fails or answers something else', async () => {
    api.getTasks.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ not: 'a list' })
    const { result, rerender } = renderHook(({ id }) => useTaskSuggestions(id), { initialProps: { id: 7 } })
    await waitFor(() => expect(api.getTasks).toHaveBeenCalledTimes(1))
    expect(result.current).toEqual([])

    rerender({ id: 8 })
    await waitFor(() => expect(api.getTasks).toHaveBeenCalledTimes(2))
    expect(result.current).toEqual([])
  })
})
