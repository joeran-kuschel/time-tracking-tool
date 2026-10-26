import { describe, expect, test, vi } from 'vitest'
import { renderWithRouter as render, screen, within } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import { i18n } from '@/i18n'
import MonthSummary from '@/components/MonthSummary'

const now = new Date(2026, 8, 22, 12, 0)
const projects = [{ id: 7, name: 'Website', hourly_rate: '95.00' }, { id: 8, name: 'Wartung', hourly_rate: '80.00' }]
const entries = [
  { id: 1, project_id: 7, start_time: '2026-09-21T09:00:00', end_time: '2026-09-21T12:30:00' },
  { id: 2, project_id: 8, start_time: '2026-09-17T14:00:00', end_time: '2026-09-17T15:30:00' },
  { id: 3, project_id: 7, start_time: '2026-08-31T09:00:00', end_time: '2026-08-31T17:00:00' },
  { id: 4, project_id: 7, start_time: '2026-09-22T10:00:00', end_time: null },
]

function figure(label) {
  return screen.getByText(label).nextElementSibling
}

describe('MonthSummary', () => {
  test('sums up the finished entries of the current month', () => {
    render(<MonthSummary entries={entries} projects={projects} customerId={3} now={now} />)

    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeInTheDocument()
    expect(figure('Stunden diesen Monat')).toHaveTextContent('5,00 h')
    expect(figure('Abrechenbarer Betrag')).toHaveTextContent('452,50 €')
    expect(figure('Einträge')).toHaveTextContent('2')
    const perProject = screen.getAllByRole('listitem')
    expect(within(perProject[0]).getByText('Website')).toBeInTheDocument()
    expect(perProject[0]).toHaveTextContent('3,50 h')
    expect(perProject[1]).toHaveTextContent('1,50 h')
  })

  test("gives screen readers each project's share of the total", () => {
    render(<MonthSummary entries={entries} projects={projects} customerId={3} now={now} />)
    const perProject = screen.getAllByRole('listitem')
    expect(perProject[0]).toHaveTextContent('3,50 h, 70 % vom Gesamtwert')
    expect(perProject[1]).toHaveTextContent('1,50 h, 30 % vom Gesamtwert')
  })

  test('words the share in the active language', () => {
    i18n.activate('en')
    render(<MonthSummary entries={entries} projects={projects} customerId={3} now={now} />)
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('3.50 h, 70% of total')
  })

  test('says so when nothing is recorded this month', () => {
    render(<MonthSummary entries={[]} projects={projects} customerId={3} now={now} />)
    expect(screen.getByText('In diesem Monat ist noch keine Zeit erfasst.')).toBeInTheDocument()
  })

  test('opens the report', async () => {
    render(<MonthSummary entries={entries} projects={projects} customerId={3} now={now} />)

    expect(screen.getByRole('link', { name: 'Bericht öffnen' })).toHaveAttribute('href', '/reports/3')
  })

  test('has no detectable accessibility violations', async () => {
    const { container } = render(<MonthSummary entries={entries} projects={projects} customerId={3} now={now} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
