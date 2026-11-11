import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook, waitFor } from '../support/render'
import { useSettings } from '@/hooks/useSettings'
import { api, ApiError } from '@/api'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { getSettings: vi.fn(), updateSettings: vi.fn() },
}))

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('useSettings', () => {
  test('is null until the settings are loaded, then holds them (loaded once)', async () => {
    api.getSettings.mockResolvedValue({ a: 1 })
    const { result, rerender } = renderHook(() => useSettings())

    expect(result.current.values).toBeNull()
    await waitFor(() => expect(result.current.values).toEqual({ a: 1 }))
    rerender()

    expect(api.getSettings).toHaveBeenCalledTimes(1)
    expect(result.current.error).toBeNull()
  })

  test('keeps an error and no values when loading fails, and loads again on request', async () => {
    api.getSettings.mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValueOnce({ a: 1 })
    const { result } = renderHook(() => useSettings())

    await waitFor(() => expect(result.current.error).toBe('Einstellungen konnten nicht geladen werden. Bitte versuche es erneut.'))
    expect(result.current.values).toBeNull()

    await act(async () => result.current.load())

    expect(result.current.values).toEqual({ a: 1 })
    expect(result.current.error).toBeNull()
  })

  test('save sends the changes and replaces the values with the saved ones', async () => {
    api.getSettings.mockResolvedValue({ a: 1, b: 1 })
    api.updateSettings.mockResolvedValue({ a: 2, b: 1 })
    const { result } = renderHook(() => useSettings())
    await waitFor(() => expect(result.current.values).not.toBeNull())

    let saved
    await act(async () => {
      saved = await result.current.save({ a: 2 })
    })

    expect(api.updateSettings).toHaveBeenCalledWith({ a: 2 })
    expect(saved).toEqual({ a: 2, b: 1 })
    expect(result.current.values).toEqual({ a: 2, b: 1 })
  })

  test('clear hides the error', async () => {
    api.getSettings.mockRejectedValue(new ApiError(500, 'boom'))
    const { result } = renderHook(() => useSettings())
    await waitFor(() => expect(result.current.error).not.toBeNull())

    act(() => result.current.clear())

    expect(result.current.error).toBeNull()
  })

  test('a failed save keeps the old values, returns undefined and sets an error', async () => {
    api.getSettings.mockResolvedValue({ a: 1 })
    api.updateSettings.mockRejectedValue(new ApiError(500, 'boom'))
    const { result } = renderHook(() => useSettings())
    await waitFor(() => expect(result.current.values).not.toBeNull())

    let saved = 'unset'
    await act(async () => {
      saved = await result.current.save({ a: 2 })
    })

    expect(saved).toBeUndefined()
    expect(result.current.values).toEqual({ a: 1 })
    expect(result.current.error).toBe('Einstellungen konnten nicht gespeichert werden. Bitte versuche es erneut.')
  })
})
