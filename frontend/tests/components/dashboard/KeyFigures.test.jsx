import { describe, expect, test } from 'vitest'
import { render, screen } from '../../support/render'
import { axe } from '../../support/axe'
import { i18n } from '@/i18n'
import KeyFigures from '@/components/dashboard/KeyFigures'

// Thursday, 24 September 2026
const now = new Date(2026, 8, 24, 15, 0)
const lastMonthReports = { month: 8, year: 2026, reports: [] }
const entry = (id, start, end, billed) => ({
  id, customer_id: 1, customer_name: 'Muster GmbH', project_id: 7, project_name: 'Website', hourly_rate: '80.00',
  start_time: start, end_time: end, ...(billed ? { billed_hours: billed[0], billed_amount: billed[1] } : {}),
})
const rule = { minutes: 15, direction: 'up' }
// 20 min on Monday this week (0.50 h billed = 40.00), 7 min on Tuesday (0.25 h billed = 20.00)
const rounded = [
  entry(1, '2026-09-21T09:00:00', '2026-09-21T09:20:00', ['0.50', '40.00']),
  entry(2, '2026-09-22T09:00:00', '2026-09-22T09:07:00', ['0.25', '20.00']),
]

const figure = (label) => screen.getByText(label).parentElement

describe('KeyFigures with a rounding rule', () => {
  test('keeps this week and this month exact and bills the rounded hours', () => {
    render(<KeyFigures entries={rounded} lastMonthReports={lastMonthReports} now={now} rounding={rule} />)

    expect(figure('Diese Woche')).toHaveTextContent('0,45 h')
    expect(figure('Dieser Monat')).toHaveTextContent('0,45 h')
    expect(figure('Abrechenbar im September')).toHaveTextContent(/60,00\s€/)
    expect(figure('Abrechenbar im September')).toHaveTextContent('Gerundete Stunden × Stundensatz des Projekts')
  })

  test('says "Rounded hours" in English', () => {
    i18n.activate('en')
    render(<KeyFigures entries={rounded} lastMonthReports={lastMonthReports} now={now} rounding={rule} />)

    expect(screen.getByText('Rounded hours × hourly rate of each project')).toBeInTheDocument()
  })

  test('without a rule it bills the exact hours with the plain note', () => {
    const exact = rounded.map(({ billed_hours, billed_amount, ...rest }) => rest)
    render(<KeyFigures entries={exact} lastMonthReports={lastMonthReports} now={now} />)

    expect(figure('Abrechenbar im September')).toHaveTextContent(/36,00\s€/)
    expect(figure('Abrechenbar im September')).toHaveTextContent('Stundensatz des Projekts')
    expect(screen.queryByText(/Gerundete/)).not.toBeInTheDocument()
  })

  test('shows the amount for entries that carry billed fields even if the rule is missing, without breaking', () => {
    render(<KeyFigures entries={rounded} lastMonthReports={lastMonthReports} now={now} />)

    expect(figure('Abrechenbar im September')).toHaveTextContent(/60,00\s€/)
    expect(figure('Abrechenbar im September')).not.toHaveTextContent('Gerundete')
  })

  test('counts a running entry as 0 hours and nothing billed', () => {
    const running = entry(3, '2026-09-24T09:00:00', null, [null, null])
    render(<KeyFigures entries={[...rounded, { ...running, billed_hours: null, billed_amount: null }]} lastMonthReports={lastMonthReports} now={now} rounding={rule} />)

    expect(figure('Dieser Monat')).toHaveTextContent('0,45 h')
    expect(figure('Abrechenbar im September')).toHaveTextContent(/60,00\s€/)
  })

  test('leaves out rounded entries of the previous month and the next month, which the dashboard range can contain', () => {
    // the dashboard loads the month plus the current week, so entries next to the month can be in the data
    const early = entry(4, '2026-08-31T09:00:00', '2026-08-31T10:05:00', ['1.25', '100.00'])
    const late = entry(5, '2026-10-01T09:00:00', '2026-10-01T10:05:00', ['1.25', '100.00'])
    render(<KeyFigures entries={[...rounded, early, late]} lastMonthReports={lastMonthReports} now={now} rounding={rule} />)

    expect(figure('Dieser Monat')).toHaveTextContent('0,45 h')
    expect(figure('Abrechenbar im September')).toHaveTextContent(/60,00\s€/)
  })

  test('has no detectable accessibility violations', async () => {
    const { container } = render(<KeyFigures entries={rounded} lastMonthReports={lastMonthReports} now={now} rounding={rule} />)

    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('KeyFigures with rounding rules that differ by customer', () => {
  test('bills the rounded hours and names the way in the note of the amount', () => {
    render(<KeyFigures entries={rounded} lastMonthReports={lastMonthReports} now={now} rounding={{ mixed: true }} />)

    expect(figure('Abrechenbar im September')).toHaveTextContent(/60,00\s€/)
    expect(figure('Abrechenbar im September')).toHaveTextContent('Gerundete Stunden × Stundensatz des Projekts')
  })
})
