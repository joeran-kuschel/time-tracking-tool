import { describe, expect, test, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import Timer from '@/components/Timer'

const website = { id: 7, name: 'Website' }
const shop = { id: 8, name: 'Shop' }
const running = { id: 42, project_id: 7, project_name: 'Website', description: 'Konzept', start_time: new Date().toISOString() }

function renderTimer(props) {
  return render(<Timer project={website} activeEntry={null} onStart={vi.fn()} onStop={vi.fn()} error={null} {...props} />)
}

describe('Timer', () => {
  test('starts the selected project with the typed description', async () => {
    const onStart = vi.fn().mockResolvedValue({ id: 42 })
    renderTimer({ onStart })

    await userEvent.type(screen.getByLabelText('Beschreibung (optional)'), 'Konzept')
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))

    expect(onStart).toHaveBeenCalledWith('Konzept')
    expect(screen.getByLabelText('Beschreibung (optional)')).toHaveValue('')
  })

  test('marks Start and Stop as disabled while a start or stop is being sent', () => {
    const { rerender } = renderTimer({ busy: true })
    expect(screen.getByRole('button', { name: 'Start' })).toHaveAttribute('aria-disabled', 'true')

    rerender(<Timer project={website} activeEntry={running} onStart={vi.fn()} onStop={vi.fn()} error={null} busy />)
    expect(screen.getByRole('button', { name: 'Stop' })).toHaveAttribute('aria-disabled', 'true')
  })

  test('keeps the description when starting fails', async () => {
    renderTimer({ onStart: vi.fn().mockResolvedValue(undefined) })

    await userEvent.type(screen.getByLabelText('Beschreibung (optional)'), 'Konzept')
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))

    expect(screen.getByLabelText('Beschreibung (optional)')).toHaveValue('Konzept')
  })

  test('shows the running entry with its start, its description and a Stop button', async () => {
    const onStop = vi.fn().mockResolvedValue({ id: 42 })
    const startedAt = new Date(2026, 8, 22, 10, 2)
    renderTimer({ activeEntry: { ...running, start_time: startedAt.toISOString() }, onStop })

    expect(screen.getByRole('heading', { name: 'Website' })).toBeInTheDocument()
    expect(screen.getByText('Läuft seit 10:02')).toBeInTheDocument()
    expect(screen.getByLabelText('Beschreibung (optional)')).toHaveValue('Konzept')

    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))

    expect(onStop).toHaveBeenCalled()
  })

  test('keeps showing the running project when another project is selected', () => {
    renderTimer({ project: shop, activeEntry: running })

    expect(screen.getByRole('heading', { name: 'Website' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument()
    expect(screen.getByText('Der Timer läuft für Website. Stoppe ihn, um Shop zu starten.')).toBeInTheDocument()
  })

  test('shows the running timer when no project is selected', () => {
    renderTimer({ project: null, activeEntry: running })
    expect(screen.getByRole('heading', { name: 'Website' })).toBeInTheDocument()
  })

  test('without a project, Start stays focusable but does nothing', async () => {
    const onStart = vi.fn()
    renderTimer({ project: null, onStart })

    const start = screen.getByRole('button', { name: 'Start' })
    expect(start).toHaveAttribute('aria-disabled', 'true')
    expect(start).toHaveAccessibleDescription('Wähle ein Projekt, um den Timer zu starten.')

    await userEvent.click(start)
    expect(onStart).not.toHaveBeenCalled()
    expect(start).toHaveFocus()
  })

  test('keeps focus on the button after stopping when no project is selected', async () => {
    // Parent that clears the running entry after stopping, like the Time tracking page after a reload
    function Parent() {
      const [activeEntry, setActiveEntry] = useState(running)
      const onStop = async () => {
        setActiveEntry(null)
        return { id: 42 }
      }
      return <Timer project={null} activeEntry={activeEntry} onStart={vi.fn()} onStop={onStop} error={null} />
    }
    render(<Parent />)

    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))

    expect(screen.getByRole('button', { name: 'Start' })).toHaveFocus()
  })

  test('bare, it drops the card heading but still shows that it runs', () => {
    const { rerender } = renderTimer({ bare: true })
    expect(screen.queryByRole('heading', { name: 'Timer' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()

    rerender(<Timer project={website} activeEntry={running} onStart={vi.fn()} onStop={vi.fn()} error={null} bare />)
    expect(screen.getByText(/^Läuft seit/)).toBeInTheDocument()
  })

  test('shows the error it is given', () => {
    renderTimer({ error: 'Timer konnte nicht gestartet werden. Bitte versuche es erneut.' })
    expect(screen.getByRole('alert')).toHaveTextContent('Timer konnte nicht gestartet werden.')
  })

  test('has no detectable accessibility violations, idle and running', async () => {
    const { container, rerender } = renderTimer({ error: 'Fehler.' })
    expect(await axe(container)).toHaveNoViolations()

    rerender(<Timer project={shop} activeEntry={running} onStart={vi.fn()} onStop={vi.fn()} error={null} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
