import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from '../test/axe'
import Timer from './Timer'
import { api, ApiError } from '../api'

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { createTimeEntry: vi.fn(), stopTimeEntry: vi.fn() },
}))

const project = { id: 7, name: 'Website' }
const entry = { id: 42, start_time: new Date().toISOString() }

function renderTimer(onEntryStopped = vi.fn()) {
  const { container } = render(<Timer project={project} onEntryCreated={vi.fn()} onEntryStopped={onEntryStopped} />)
  return { container, onEntryStopped }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('Timer', () => {
  test('starts only after the backend created the entry', async () => {
    api.createTimeEntry.mockResolvedValue(entry)
    renderTimer()

    await userEvent.click(screen.getByRole('button', { name: 'Start' }))

    expect(api.createTimeEntry).toHaveBeenCalledWith(7, expect.any(String), '')
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('stays stopped and shows an error when starting fails', async () => {
    api.createTimeEntry.mockRejectedValue(new ApiError(500, 'boom'))
    renderTimer()

    await userEvent.click(screen.getByRole('button', { name: 'Start' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Timer konnte nicht gestartet werden.')
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  test('keeps running and shows an error when stopping fails', async () => {
    api.createTimeEntry.mockResolvedValue(entry)
    api.stopTimeEntry.mockRejectedValue(new ApiError(0, 'unreachable'))
    const { onEntryStopped } = renderTimer()

    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Timer konnte nicht gestoppt werden. Der Server ist nicht erreichbar.')
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(onEntryStopped).not.toHaveBeenCalled()
  })

  test('stops the entry that was started', async () => {
    api.createTimeEntry.mockResolvedValue(entry)
    api.stopTimeEntry.mockResolvedValue({ ...entry, end_time: new Date().toISOString() })
    const { onEntryStopped } = renderTimer()

    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))

    expect(api.stopTimeEntry).toHaveBeenCalledWith(42, expect.any(String))
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
    expect(onEntryStopped).toHaveBeenCalled()
  })

  test('has no detectable accessibility violations with an error shown', async () => {
    api.createTimeEntry.mockRejectedValue(new ApiError(500, 'boom'))
    const { container } = renderTimer()
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))

    expect(await axe(container)).toHaveNoViolations()
  })
})
