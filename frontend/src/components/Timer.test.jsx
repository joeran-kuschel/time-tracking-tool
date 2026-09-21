import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from '../test/axe'
import Timer from './Timer'

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
    expect(screen.getByRole('status')).toHaveTextContent('Timer gestartet für Website')
  })

  test('keeps the description when starting fails', async () => {
    renderTimer({ onStart: vi.fn().mockResolvedValue(undefined) })

    await userEvent.type(screen.getByLabelText('Beschreibung (optional)'), 'Konzept')
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))

    expect(screen.getByLabelText('Beschreibung (optional)')).toHaveValue('Konzept')
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  test('shows the running entry with its description and a Stop button', async () => {
    const onStop = vi.fn().mockResolvedValue({ id: 42 })
    renderTimer({ activeEntry: running, onStop })

    expect(screen.getByRole('heading', { name: 'Website' })).toBeInTheDocument()
    expect(screen.getByLabelText('Beschreibung (optional)')).toHaveValue('Konzept')

    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))

    expect(onStop).toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Timer gestoppt')
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
