import { describe, expect, test } from 'vitest'
import { render, screen } from '../test/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../test/axe'
import Tabs from './Tabs'

const tabs = [
  { id: 'a', label: 'Timer', panel: <input aria-label="Beschreibung" /> },
  { id: 'b', label: 'Nachtragen', panel: <p>Formular</p> },
  { id: 'c', label: 'Drittes', panel: <p>Drei</p> },
]

describe('Tabs', () => {
  test('shows the first tab and has no axe violations', async () => {
    const { container } = render(<Tabs label="Zeit erfassen" tabs={tabs} />)

    expect(screen.getByRole('tablist', { name: 'Zeit erfassen' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Timer' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: 'Timer' })).toBeVisible()
    expect(screen.queryByText('Formular')).not.toBeVisible()
    expect(await axe(container)).toHaveNoViolations()
  })

  test('selects a tab by click and keeps the other panels\' state', async () => {
    render(<Tabs label="Zeit erfassen" tabs={tabs} />)
    await userEvent.type(screen.getByLabelText('Beschreibung'), 'Konzept')

    await userEvent.click(screen.getByRole('tab', { name: 'Nachtragen' }))
    expect(screen.getByText('Formular')).toBeVisible()

    await userEvent.click(screen.getByRole('tab', { name: 'Timer' }))
    expect(screen.getByLabelText('Beschreibung')).toHaveValue('Konzept')
  })

  test('has one tab stop and moves with arrow keys, Home and End, wrapping around', async () => {
    render(<Tabs label="Zeit erfassen" tabs={tabs} />)
    await userEvent.tab()
    expect(screen.getByRole('tab', { name: 'Timer' })).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Nachtragen' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Nachtragen' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Drittes' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Timer' })).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Drittes' })).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Timer' })).toHaveFocus()

    expect(screen.getByRole('tab', { name: 'Nachtragen' })).toHaveAttribute('tabindex', '-1')
  })
})
