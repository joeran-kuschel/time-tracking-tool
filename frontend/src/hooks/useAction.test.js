import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAction } from './useAction'
import { ApiError } from '../api'

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('useAction', () => {
  test('returns the result and no error on success', async () => {
    const { result } = renderHook(() => useAction())
    let value
    await act(async () => {
      value = await result.current[0](() => Promise.resolve('ok'), 'Fehler.')
    })
    expect(value).toBe('ok')
    expect(result.current[1]).toBeNull()
  })

  test('returns undefined and asks to retry when the request fails', async () => {
    const { result } = renderHook(() => useAction())
    let value
    await act(async () => {
      value = await result.current[0](() => Promise.reject(new ApiError(500, 'boom')), 'Kunde konnte nicht angelegt werden.')
    })
    expect(value).toBeUndefined()
    expect(result.current[1]).toBe('Kunde konnte nicht angelegt werden. Bitte versuche es erneut.')
  })

  test('says the server is unreachable for network errors', async () => {
    const { result } = renderHook(() => useAction())
    await act(async () => {
      await result.current[0](() => Promise.reject(new ApiError(0, 'unreachable')), 'Fehler.')
    })
    expect(result.current[1]).toBe('Fehler. Der Server ist nicht erreichbar.')
  })

  test('clears the previous error when the next call succeeds', async () => {
    const { result } = renderHook(() => useAction())
    await act(async () => {
      await result.current[0](() => Promise.reject(new ApiError(500, 'boom')), 'Fehler.')
    })
    await act(async () => {
      await result.current[0](() => Promise.resolve('ok'), 'Fehler.')
    })
    expect(result.current[1]).toBeNull()
  })
})
