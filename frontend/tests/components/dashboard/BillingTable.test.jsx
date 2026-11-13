import { describe, expect, test } from 'vitest'
import { renderWithRouter as render, screen, within } from '../../support/render'
import { axe } from '../../support/axe'
import { i18n } from '@/i18n'
import BillingTable from '@/components/dashboard/BillingTable'

const now = new Date(2026, 8, 22, 12, 0)
const lastMonthReports = { month: 8, year: 2026, reports: [] }
const row = (customerId, name, hours, amount, rates) => ({ customerId, name, hours, amount, rates, projects: [{ project: { name: 'Website' } }] })
// the hours and amounts are the billed ones (summed by byCustomer)
const rows = [row(1, 'Muster GmbH', 1.75, 158.75, [80, 95]), row(2, 'Berger', 0.25, 21.25, [85])]
const rule = { minutes: 15, direction: 'up' }

function renderTable(props = {}) {
  return render(<BillingTable rows={rows} now={now} lastMonthReports={lastMonthReports} {...props} />)
}

describe('BillingTable', () => {
  test('shows hours, rates and amount per customer and the total', () => {
    renderTable({ rounding: rule })

    const [, muster, berger, total] = within(screen.getByRole('table', { name: 'Abrechnung · September 2026' })).getAllByRole('row')
    // the digit after the name is the number of projects
    expect(muster).toHaveTextContent(/Muster GmbH11,75 h80,00\s€\/h, 95,00\s€\/h158,75\s€/)
    expect(berger).toHaveTextContent(/Berger10,25 h85,00\s€\/h21,25\s€/)
    expect(total).toHaveTextContent(/Gesamt2,00 h180,00\s€/)
  })

  test('names the rounding rule once, under the heading', () => {
    renderTable({ rounding: rule })

    expect(screen.getAllByText('Stunden auf Viertelstunden aufgerundet.')).toHaveLength(1)
  })

  test('names the rule in English', () => {
    i18n.activate('en')
    renderTable({ rounding: { minutes: 30, direction: 'up' } })

    expect(screen.getByText('Hours rounded up to half hours.')).toBeInTheDocument()
  })

  test.each([
    [{ minutes: 5, direction: 'up' }, 'Stunden auf Schritte von 5 Minuten aufgerundet.'],
    [{ minutes: 10, direction: 'nearest' }, 'Stunden auf die nächstgelegenen 10 Minuten gerundet.'],
    [{ minutes: 60, direction: 'up' }, 'Stunden auf volle Stunden aufgerundet.'],
  ])('names the new rule %j', (rounding, sentence) => {
    renderTable({ rounding })

    expect(screen.getAllByText(sentence)).toHaveLength(1)
  })

  test('names no rule without one', () => {
    const { rerender } = renderTable()
    expect(screen.queryByText(/gerundet/)).not.toBeInTheDocument()

    rerender(<BillingTable rows={rows} now={now} lastMonthReports={lastMonthReports} rounding={null} />)

    expect(screen.queryByText(/gerundet/)).not.toBeInTheDocument()
  })

  test('shows only the empty message for an empty month, with no note and no table', () => {
    renderTable({ rows: [], rounding: rule })

    expect(screen.getByText('In diesem Monat ist noch keine Zeit erfasst.')).toBeInTheDocument()
    expect(screen.queryByText(/gerundet/)).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  test('has no detectable accessibility violations with the note', async () => {
    const { container } = renderTable({ rounding: rule })

    expect(await axe(container)).toHaveNoViolations()
  })
})
