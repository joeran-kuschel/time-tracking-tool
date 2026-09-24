import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '../test/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../test/axe'
import RunningTimer from './RunningTimer'

const running = { id: 42, project_name: 'Website', customer_name: 'Muster GmbH', start_time: new Date().toISOString() }

describe('RunningTimer', () => {
  test('shows the project, the customer and the elapsed time', () => {
    render(<RunningTimer entry={running} onStop={vi.fn()} />)

    const region = screen.getByRole('region', { name: 'Laufender Timer' })
    expect(region).toHaveTextContent('Website')
    expect(region).toHaveTextContent('· Muster GmbH')
    expect(region).toHaveTextContent('00:00:00')
  })

  test('stops the timer with a button named for it', async () => {
    const onStop = vi.fn()
    render(<RunningTimer entry={running} onStop={onStop} />)

    await userEvent.click(screen.getByRole('button', { name: 'Stop Timer' }))

    expect(onStop).toHaveBeenCalled()
  })

  test('marks the Stop button as disabled while the stop is being sent', () => {
    render(<RunningTimer entry={running} onStop={vi.fn()} busy />)

    expect(screen.getByRole('button', { name: 'Stop Timer' })).toHaveAttribute('aria-disabled', 'true')
  })

  test('has no detectable accessibility violations', async () => {
    const { container } = render(<RunningTimer entry={running} onStop={vi.fn()} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
