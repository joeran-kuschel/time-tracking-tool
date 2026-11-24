import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook } from '../support/render'
import { useBulkTask } from '@/hooks/useBulkTask'
import { api, ApiError } from '@/api'

vi.mock('@/api', async (importOriginal) => ({ ...(await importOriginal()), api: { setTask: vi.fn() } }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

const selected = (ids, onDone) => {
  const hook = renderHook(() => useBulkTask(onDone))
  act(() => hook.result.current.selection.setMany(ids, true))
  return hook
}

describe('useBulkTask', () => {
  test('sets the task of the selection, clears it, reports the count and reloads', async () => {
    api.setTask.mockResolvedValue({ updated: 2 })
    const onDone = vi.fn()
    const { result } = selected([5, 6], onDone)

    let ok
    await act(async () => { ok = await result.current.apply('Fix login') })

    expect(ok).toBe(true)
    expect(api.setTask).toHaveBeenCalledWith([5, 6], 'Fix login')
    expect(result.current.selection.count).toBe(0)
    expect(result.current.done).toEqual({ count: 2 })
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(result.current.busy).toBe(false)
  })

  test('forgets the last result when a new selection starts', async () => {
    api.setTask.mockResolvedValue({ updated: 1 })
    const { result } = selected([5])
    await act(async () => { await result.current.apply('A') })
    expect(result.current.done).toEqual({ count: 1 })

    act(() => result.current.selection.toggle(6))
    expect(result.current.done).toBeNull()

    act(() => result.current.selection.clear())
    expect(result.current.done).toBeNull()
  })

  test('keeps the selection and shows an error when it fails', async () => {
    api.setTask.mockRejectedValue(new ApiError(500, 'x'))
    const onDone = vi.fn()
    const { result } = selected([5], onDone)

    let ok
    await act(async () => { ok = await result.current.apply('Fix login') })

    expect(ok).toBe(false)
    expect(result.current.selection.ids).toEqual([5])
    expect(result.current.error).toContain('Die Aufgabe konnte nicht gesetzt werden.')
    expect(result.current.done).toBeNull()
    expect(onDone).not.toHaveBeenCalled()
  })

  test.each([
    [404, 'Ein Eintrag existiert nicht mehr'],
    [409, 'Für einen der Einträge läuft ein Timer'],
  ])('explains a %i', async (status, text) => {
    api.setTask.mockRejectedValue(new ApiError(status, 'x'))
    const { result } = selected([5])

    await act(async () => { await result.current.apply('A') })

    expect(result.current.error).toContain(text)
  })

  test('sends one request for a double click', async () => {
    let finish
    api.setTask.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const { result } = selected([5])

    let first
    let second
    await act(async () => {
      first = result.current.apply('A')
      second = result.current.apply('A')
      finish({ updated: 1 })
      await Promise.all([first, second])
    })

    expect(api.setTask).toHaveBeenCalledTimes(1)
    expect(await second).toBe(false)
  })
})
