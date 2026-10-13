import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '../../support/render'
import { axe } from '../../support/axe'
import { i18n } from '@/i18n'
import ByCustomer from '@/components/dashboard/ByCustomer'

const now = new Date(2026, 8, 22, 12, 0)
const rows = [
  { customerId: 1, name: 'Muster GmbH', hours: 3, amount: 285, projects: [{ project: { name: 'Website' } }] },
  { customerId: 2, name: 'Berger', hours: 1, amount: 85, projects: [{ project: { name: 'Pflege' } }] },
]

describe('ByCustomer', () => {
  test("gives screen readers each customer's share of the total", () => {
    render(<ByCustomer rows={rows} now={now} onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Muster GmbH.*3,00 h, 75\s%\svom Gesamtwert/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Berger.*1,00 h, 25\s%\svom Gesamtwert/ })).toBeInTheDocument()
  })

  test('follows the active language', () => {
    i18n.activate('en')
    render(<ByCustomer rows={rows} now={now} onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Muster GmbH.*3\.00 h, 75% of total/ })).toBeInTheDocument()
  })

  test('shows 0 % without NaN when the total hours are 0', () => {
    const { container } = render(<ByCustomer rows={[{ ...rows[0], hours: 0 }]} now={now} onSelect={vi.fn()} />)
    expect(container).toHaveTextContent('0 % vom Gesamtwert')
    expect(container).not.toHaveTextContent('NaN')
  })

  test('rounds the share to whole percent', () => {
    const thirds = [{ ...rows[0], hours: 2 }, { ...rows[1], hours: 1 }]
    render(<ByCustomer rows={thirds} now={now} onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Muster GmbH.*2,00 h, 67\s%\svom Gesamtwert/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Berger.*1,00 h, 33\s%\svom Gesamtwert/ })).toBeInTheDocument()
  })

  test('shows no share when there are no customers', () => {
    const { container } = render(<ByCustomer rows={[]} now={now} onSelect={vi.fn()} />)
    expect(container).toHaveTextContent('In diesem Monat ist noch keine Zeit erfasst.')
    expect(container).not.toHaveTextContent('Gesamtwert')
  })

  test('has no detectable accessibility violations', async () => {
    const { container } = render(<ByCustomer rows={rows} now={now} onSelect={vi.fn()} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
