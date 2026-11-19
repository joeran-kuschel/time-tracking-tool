import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import ResumeButton, { ResumeHints } from '@/components/ResumeButton'

const finished = { id: 5, description: 'Login', start_time: '2026-09-21T08:00:00Z', end_time: '2026-09-21T09:00:00Z' }
const idle = (onResume = vi.fn()) => ({ onResume, timerRunning: false, busy: false })

function renderButton(entry, resume) {
  return render(<><ResumeButton entry={entry} projectName="Website" resume={resume} /><ResumeHints /></>)
}

describe('ResumeButton', () => {
  test('names the project and the description', () => {
    renderButton(finished, idle())

    expect(screen.getByRole('button', { name: 'Fortsetzen: Website, Login' })).toBeInTheDocument()
  })

  test('names only the project without a description', () => {
    renderButton({ ...finished, description: '' }, idle())

    expect(screen.getByRole('button', { name: 'Fortsetzen: Website' })).toBeInTheDocument()
  })

  test('renders nothing without resume or for a running entry', () => {
    const { rerender } = renderButton(finished, undefined)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()

    rerender(<ResumeButton entry={{ ...finished, end_time: null }} projectName="Website" resume={idle()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  test('calls onResume with the entry, by mouse and by keyboard', async () => {
    const onResume = vi.fn()
    renderButton(finished, idle(onResume))
    const button = screen.getByRole('button')

    await userEvent.click(button)
    button.focus()
    await userEvent.keyboard('{Enter}')

    expect(onResume).toHaveBeenCalledTimes(2)
    expect(onResume).toHaveBeenCalledWith(finished)
  })

  test('describes that the time since the end counts as work time', () => {
    renderButton(finished, idle())

    expect(screen.getByRole('button')).toHaveAccessibleDescription('Der Eintrag läuft weiter: die Zeit seit seinem Ende zählt als Arbeitszeit.')
  })

  test('while a timer runs, does nothing, stays focusable and says to stop it first', async () => {
    const onResume = vi.fn()
    renderButton(finished, { ...idle(onResume), timerRunning: true })
    const button = screen.getByRole('button')

    await userEvent.tab()
    await userEvent.keyboard('{Enter}')

    expect(button).toHaveFocus()
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleDescription('Stoppe zuerst den laufenden Timer.')
    expect(onResume).not.toHaveBeenCalled()
  })

  test('while a start or stop is being sent, does nothing', async () => {
    const onResume = vi.fn()
    renderButton(finished, { ...idle(onResume), busy: true })

    await userEvent.click(screen.getByRole('button'))

    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true')
    expect(onResume).not.toHaveBeenCalled()
  })

  test('has no accessibility violations', async () => {
    const { container } = renderButton(finished, idle())

    expect(await axe(container)).toHaveNoViolations()
  })
})
