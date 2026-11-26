import { describe, expect, test } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen, within } from '../../support/render'
import { axe } from '../../support/axe'
import HoursChart from '@/components/dashboard/HoursChart'

// Thursday, 24 September 2026
const now = new Date(2026, 8, 24, 15, 0)
const rule = { minutes: 15, direction: 'up' }
const entry = (id, start, end, billed) => ({
  id, customer_id: 1, customer_name: 'Muster GmbH', project_id: 7, project_name: 'Website', hourly_rate: '80.00',
  start_time: start, end_time: end, ...(billed ? { billed_hours: billed, billed_amount: '0.00', billed_rule: rule } : {}),
})
// Monday the 21st: 7 minutes, billed as 0.25 h; Tuesday the 22nd: 44 minutes, billed as 0.75 h. Tracked 0:51 h, billed 1:00 h.
const entries = [
  entry(1, '2026-09-21T09:00:00', '2026-09-21T09:07:00', '0.25'),
  entry(2, '2026-09-22T09:00:00', '2026-09-22T09:44:00', '0.75'),
]
const plain = entries.map(({ billed_hours, billed_amount, billed_rule, ...rest }) => rest)

const basisSwitch = () => screen.getByRole('group', { name: 'Grundlage der Stunden' })
const dayRow = (name) => screen.getByRole('row', { name })

describe('HoursChart without a rounding rule', () => {
  test('has no tracked / billed switch and shows the tracked time', () => {
    render(<HoursChart entries={plain} now={now} />)

    expect(screen.queryByRole('group', { name: 'Grundlage der Stunden' })).not.toBeInTheDocument()
    expect(screen.getByText('0:51 h in diesem Monat')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Ansicht des Diagramms' })).toBeInTheDocument()
  })
})

describe('HoursChart with a rounding rule', () => {
  test('starts with the tracked time and says so on the switch', () => {
    render(<HoursChart entries={entries} now={now} rounding={rule} />)

    expect(within(basisSwitch()).getByRole('button', { name: 'Erfasst' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(basisSwitch()).getByRole('button', { name: 'Abrechenbar' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('0:51 h in diesem Monat')).toBeInTheDocument()
    expect(dayRow(/21\. Sept/)).toHaveTextContent('0:07 h')
    expect(screen.queryByText('Stunden auf Viertelstunden aufgerundet.')).not.toBeInTheDocument()
  })

  test('the billed view shows the rounded hours, names the rule and keeps the total of the billing figures', async () => {
    render(<HoursChart entries={entries} now={now} rounding={rule} />)

    await userEvent.click(within(basisSwitch()).getByRole('button', { name: 'Abrechenbar' }))

    expect(within(basisSwitch()).getByRole('button', { name: 'Abrechenbar' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('1:00 h in diesem Monat, abrechenbar')).toBeInTheDocument()
    expect(screen.getByText('Stunden auf Viertelstunden aufgerundet.')).toBeInTheDocument()
    expect(dayRow(/21\. Sept/)).toHaveTextContent('0:15 h')
    expect(dayRow(/22\. Sept/)).toHaveTextContent('0:45 h')
    expect(screen.getByRole('table', { name: 'Abrechenbare Stunden pro Tag, September 2026' })).toBeInTheDocument()
  })

  test('switches back to the exact time', async () => {
    render(<HoursChart entries={entries} now={now} rounding={rule} />)

    await userEvent.click(within(basisSwitch()).getByRole('button', { name: 'Abrechenbar' }))
    await userEvent.click(within(basisSwitch()).getByRole('button', { name: 'Erfasst' }))

    expect(screen.getByText('0:51 h in diesem Monat')).toBeInTheDocument()
    expect(dayRow(/21\. Sept/)).toHaveTextContent('0:07 h')
    expect(screen.queryByText('Stunden auf Viertelstunden aufgerundet.')).not.toBeInTheDocument()
  })

  test('the billed view works for the weeks and keeps the focus on the switch', async () => {
    render(<HoursChart entries={entries} now={now} rounding={rule} />)

    await userEvent.click(screen.getByRole('button', { name: 'Wochen' }))
    await userEvent.click(within(basisSwitch()).getByRole('button', { name: 'Abrechenbar' }))

    expect(screen.getByRole('table', { name: 'Abrechenbare Stunden pro Woche, September 2026' })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Woche 39/ })).toHaveTextContent('1:00 h')
    expect(within(basisSwitch()).getByRole('button', { name: 'Abrechenbar' })).toHaveFocus()
  })

  test('the arrow keys read the billed values', async () => {
    render(<HoursChart entries={entries} now={now} rounding={rule} />)
    await userEvent.click(within(basisSwitch()).getByRole('button', { name: 'Abrechenbar' }))

    screen.getByRole('group', { name: /Balken/ }).focus()
    await userEvent.keyboard('{Home}{ArrowRight>20/}')

    expect(screen.getByText('Mo., 21. Sept.: 0:15 h')).toBeInTheDocument()
  })

  test('switching the basis drops the read bar and shows the month total again', async () => {
    render(<HoursChart entries={entries} now={now} rounding={rule} />)
    screen.getByRole('group', { name: /Balken/ }).focus()
    await userEvent.keyboard('{Home}{ArrowRight>20/}')
    expect(screen.getByText('Mo., 21. Sept.: 0:07 h')).toBeInTheDocument()

    await userEvent.click(within(basisSwitch()).getByRole('button', { name: 'Abrechenbar' }))

    expect(screen.queryByText(/Mo\., 21\. Sept\.:/)).not.toBeInTheDocument()
    expect(screen.getByText('1:00 h in diesem Monat, abrechenbar')).toBeInTheDocument()
  })

  test('keeps the billed basis when switching between days and weeks', async () => {
    render(<HoursChart entries={entries} now={now} rounding={rule} />)
    await userEvent.click(within(basisSwitch()).getByRole('button', { name: 'Abrechenbar' }))

    await userEvent.click(screen.getByRole('button', { name: 'Wochen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Tage' }))

    expect(within(basisSwitch()).getByRole('button', { name: 'Abrechenbar' })).toHaveAttribute('aria-pressed', 'true')
    expect(dayRow(/22\. Sept/)).toHaveTextContent('0:45 h')
  })

  test('names that the rounding differs by customer', async () => {
    render(<HoursChart entries={entries} now={now} rounding={{ mixed: true }} />)

    await userEvent.click(within(basisSwitch()).getByRole('button', { name: 'Abrechenbar' }))

    expect(screen.getByText('Die Rundung unterscheidet sich je Kunde.')).toBeInTheDocument()
  })

  test('counts a running entry as 0 and an entry that ends before it starts with its exact minutes, as the billing figures do', async () => {
    const odd = [
      entry(3, '2026-09-23T09:00:00', null),
      entry(4, '2026-09-23T12:00:00', '2026-09-23T11:30:00'),
    ]
    render(<HoursChart entries={[...entries, ...odd]} now={now} rounding={rule} />)
    await userEvent.click(within(basisSwitch()).getByRole('button', { name: 'Abrechenbar' }))

    expect(dayRow(/23\. Sept/)).toHaveTextContent('-0:30 h')
    expect(screen.getByText('0:30 h in diesem Monat, abrechenbar')).toBeInTheDocument()
  })

  test('the scale still fits a day with more than 8 hours', async () => {
    // 9 h 05 min tracked, billed as 9.25 h
    const long = [entry(5, '2026-09-21T08:00:00', '2026-09-21T17:05:00', '9.25')]
    render(<HoursChart entries={long} now={now} rounding={rule} />)
    await userEvent.click(within(basisSwitch()).getByRole('button', { name: 'Abrechenbar' }))

    expect(screen.getByText('10')).toBeInTheDocument()
    expect(dayRow(/21\. Sept/)).toHaveTextContent('9:15 h')
  })

  test('falls back to the tracked time when the rule is gone after a reload', async () => {
    const { rerender } = render(<HoursChart entries={entries} now={now} rounding={rule} />)
    await userEvent.click(within(basisSwitch()).getByRole('button', { name: 'Abrechenbar' }))

    rerender(<HoursChart entries={plain} now={now} rounding={null} />)

    expect(screen.queryByRole('group', { name: 'Grundlage der Stunden' })).not.toBeInTheDocument()
    expect(screen.getByText('0:51 h in diesem Monat')).toBeInTheDocument()
  })

  test('has no detectable accessibility violations in either view', async () => {
    const { container } = render(<HoursChart entries={entries} now={now} rounding={rule} />)
    expect(await axe(container)).toHaveNoViolations()

    await userEvent.click(within(basisSwitch()).getByRole('button', { name: 'Abrechenbar' }))

    expect(await axe(container)).toHaveNoViolations()
  })
})
