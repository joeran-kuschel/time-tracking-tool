import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook, waitFor } from '../test/render'
import { useActiveEntry } from './useActiveEntry'
import { api, ApiError } from '../api'

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { getActiveEntry: vi.fn(), createTimeEntry: vi.fn(), stopTimeEntry: vi.fn() },
}))

const project = { id: 7, name: 'Website' }
const running = { id: 42, project_id: 7, project_name: 'Website', start_time: '2026-09-21T08:00:00Z' }

async function renderLoaded() {
  const hook = renderHook(() => useActiveEntry())
  await waitFor(() => expect(api.getActiveEntry).toHaveBeenCalled())
  return hook
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('useActiveEntry', () => {
  test('resumes the running entry from the backend', async () => {
    api.getActiveEntry.mockResolvedValue(running)
    const { result } = renderHook(() => useActiveEntry())

    await waitFor(() => expect(result.current.activeEntry).toEqual(running))
  })

  test('has no active entry when none is running', async () => {
    api.getActiveEntry.mockResolvedValue(null)
    const { result } = await renderLoaded()

    expect(result.current.activeEntry).toBeNull()
    expect(result.current.error).toBeNull()
  })

  test('shows an error when the running entry cannot be loaded', async () => {
    api.getActiveEntry.mockRejectedValue(new ApiError(0, 'unreachable'))
    const { result } = renderHook(() => useActiveEntry())

    await waitFor(() => expect(result.current.error).toBe(
      'Laufender Timer konnte nicht geladen werden. Der Server ist nicht erreichbar.'
    ))
  })

  test('start creates an entry and makes it active', async () => {
    api.getActiveEntry.mockResolvedValue(null)
    api.createTimeEntry.mockResolvedValue({ id: 42, project_id: 7, start_time: '2026-09-21T08:00:00Z' })
    const { result } = await renderLoaded()

    await act(() => result.current.start(project, 'Konzept', { id: 1, name: 'Muster GmbH' }))

    expect(api.createTimeEntry).toHaveBeenCalledWith(7, expect.any(String), 'Konzept')
    expect(result.current.activeEntry).toMatchObject({ id: 42, project_name: 'Website', customer_id: 1, customer_name: 'Muster GmbH' })
    expect(result.current.announcement).toEqual({ kind: 'started', projectName: 'Website' })
  })

  test('sends only one start for a double click, and is busy until it is answered', async () => {
    api.getActiveEntry.mockResolvedValue(null)
    let answer
    api.createTimeEntry.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    const { result } = await renderLoaded()

    let first
    let second
    act(() => {
      first = result.current.start(project, '')
      second = result.current.start(project, '')
    })
    expect(result.current.busy).toBe(true)
    await act(async () => {
      answer({ id: 42, project_id: 7, start_time: '2026-09-21T08:00:00Z' })
      await Promise.all([first, second])
    })

    expect(api.createTimeEntry).toHaveBeenCalledTimes(1)
    expect(await second).toBeUndefined()
    expect(result.current.busy).toBe(false)
    expect(result.current.activeEntry).toMatchObject({ id: 42 })
  })

  test('shows the other running timer when the backend refuses a second one', async () => {
    api.getActiveEntry.mockResolvedValueOnce(null).mockResolvedValueOnce(running)
    api.createTimeEntry.mockRejectedValue(new ApiError(409, 'A timer is already running'))
    const { result } = await renderLoaded()

    let started
    await act(async () => { started = await result.current.start(project, '') })

    expect(started).toBeUndefined()
    expect(result.current.announcement).toBeNull()
    expect(result.current.error).toBe('Timer konnte nicht gestartet werden. Es läuft bereits ein Timer.')
    expect(result.current.activeEntry).toEqual(running)
  })

  test('stop ends the active entry', async () => {
    api.getActiveEntry.mockResolvedValue(running)
    api.stopTimeEntry.mockResolvedValue({ ...running, end_time: '2026-09-21T09:00:00Z' })
    const { result } = renderHook(() => useActiveEntry())
    await waitFor(() => expect(result.current.activeEntry).toEqual(running))

    await act(() => result.current.stop())

    expect(api.stopTimeEntry).toHaveBeenCalledWith(42, expect.any(String))
    expect(result.current.activeEntry).toBeNull()
    expect(result.current.announcement).toEqual({ kind: 'stopped' })
  })

  test('sends only one stop for a double click', async () => {
    api.getActiveEntry.mockResolvedValue(running)
    api.stopTimeEntry.mockResolvedValue({ ...running, end_time: '2026-09-21T09:00:00Z' })
    const { result } = renderHook(() => useActiveEntry())
    await waitFor(() => expect(result.current.activeEntry).toEqual(running))

    await act(() => Promise.all([result.current.stop(), result.current.stop()]))

    expect(api.stopTimeEntry).toHaveBeenCalledTimes(1)
    expect(result.current.activeEntry).toBeNull()
  })

  test('keeps the entry active when stopping fails', async () => {
    api.getActiveEntry.mockResolvedValue(running)
    api.stopTimeEntry.mockRejectedValue(new ApiError(500, 'boom'))
    const { result } = renderHook(() => useActiveEntry())
    await waitFor(() => expect(result.current.activeEntry).toEqual(running))

    await act(() => result.current.stop())

    expect(result.current.activeEntry).toEqual(running)
    expect(result.current.announcement).toBeNull()
    expect(result.current.error).toBe('Timer konnte nicht gestoppt werden. Bitte versuche es erneut.')
  })
})
