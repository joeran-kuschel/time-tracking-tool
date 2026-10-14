import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, within } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import Dashboard from '@/pages/Dashboard'
import { api, ApiError } from '@/api'
import { fromInputs } from '@/entryTime'

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    api: { getDashboard: vi.fn(), createTimeEntry: vi.fn(), pdfPreviewUrl: actual.api.pdfPreviewUrl },
  }
})

const muster = { customer_id: 1, customer_name: 'Muster GmbH' }
const berger = { customer_id: 2, customer_name: 'Berger' }
const entry = (id, customer, projectId, projectName, rate, start, end, description = null) => ({
  id, ...customer, project_id: projectId, project_name: projectName, hourly_rate: rate, start_time: start, end_time: end, description,
})

const data = {
  entries: [
    entry(1, muster, 7, 'Website', '95.00', '2026-09-01T09:00:00', '2026-09-01T12:30:00'),
    entry(2, muster, 8, 'Shop', '80.00', '2026-09-21T09:00:00', '2026-09-21T10:30:00'),
    entry(3, berger, 9, 'Pflege', '85.00', '2026-09-22T13:00:00', '2026-09-22T17:00:00', 'Updates'),
  ],
  recent: [
    entry(3, berger, 9, 'Pflege', '85.00', '2026-09-22T13:00:00', '2026-09-22T17:00:00', 'Updates'),
    entry(2, muster, 8, 'Shop', '80.00', '2026-09-21T09:00:00', '2026-09-21T10:30:00'),
  ],
  projects: [
    { id: 9, name: 'Pflege', customer_id: 2, customer_name: 'Berger', hourly_rate: '85.00' },
    { id: 8, name: 'Shop', customer_id: 1, customer_name: 'Muster GmbH', hourly_rate: '80.00' },
    { id: 7, name: 'Website', customer_id: 1, customer_name: 'Muster GmbH', hourly_rate: '95.00' },
  ],
  lastMonthReports: {
    month: 8, year: 2026,
    reports: [{ ...berger, status: 'sent' }, { ...muster, status: 'ready' }],
  },
}

const stoppedTimer = () => ({ activeEntry: null, start: vi.fn(), stop: vi.fn(), error: null })

function renderDashboard(timer = stoppedTimer(), props = {}) {
  const handlers = { onOpenTimeTracking: vi.fn(), onOpenReports: vi.fn(), ...props }
  const result = render(<Dashboard timer={timer} {...handlers} />)
  return { ...result, ...handlers, timer }
}

const loaded = () => screen.findByRole('heading', { name: 'Zeit erfassen' })

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  // Thursday, 24 September 2026; only the date is fake, userEvent still needs real timers
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 24, 15, 0))
  api.getDashboard.mockResolvedValue(data)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Dashboard', () => {
  test('loads the month and the current week in one request', async () => {
    renderDashboard()
    await loaded()

    expect(api.getDashboard).toHaveBeenCalledWith(
      new Date(2026, 8, 1).toISOString(), new Date(2026, 9, 1).toISOString(), 9, 2026
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('Donnerstag, 24. September 2026')).toBeInTheDocument()
  })

  test('shows the key figures', async () => {
    renderDashboard()
    const figures = within(await screen.findByRole('region', { name: 'Kennzahlen' }))

    expect(figures.getByText('Diese Woche').nextSibling).toHaveTextContent('5,50 h')
    expect(figures.getByText('Dieser Monat').nextSibling).toHaveTextContent('9,00 h')
    expect(figures.getByText('18 Arbeitstage, 0,50 h pro Tag')).toBeInTheDocument()
    expect(figures.getByText('Abrechenbar im September').nextSibling).toHaveTextContent(/792,50\s€/)
    expect(figures.getByText('Abrechnungen für August verschickt').nextSibling).toHaveTextContent('1 von 2')
  })

  test('the chart shows the month total, and the value of a bar on hover or with the arrow keys', async () => {
    renderDashboard()
    await loaded()
    const readout = screen.getByText('9,00 h in diesem Monat')
    expect(readout).toHaveAttribute('aria-live', 'polite')

    const bars = screen.getByRole('group', { name: 'Balken, mit den Pfeiltasten die Werte lesen' })
    await userEvent.tab()
    while (document.activeElement !== bars) await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}')
    expect(readout).toHaveTextContent('Di., 1. Sept.: 3,50 h')
    await userEvent.keyboard('{End}')
    expect(readout).toHaveTextContent('Mi., 30. Sept.: noch offen')

    await userEvent.hover(bars.children[2 + 20]) // two gridlines, then 21 September
    expect(readout).toHaveTextContent('Mo., 21. Sept.: 1,50 h')
    await userEvent.unhover(bars)
    expect(readout).toHaveTextContent('9,00 h in diesem Monat')
  })

  test('switches the chart to weeks, with a table of the values for screen readers', async () => {
    renderDashboard()
    await loaded()
    expect(screen.getByRole('table', { name: 'Stunden pro Tag, September 2026' }).querySelectorAll('tbody tr')).toHaveLength(30)

    await userEvent.click(screen.getByRole('button', { name: 'Wochen', pressed: false }))

    expect(screen.getByRole('heading', { name: 'Stunden pro Woche' })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Stunden pro Woche, September 2026' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((row) => row.textContent)).toEqual([
      'Woche 36, 1. Sept. – 6. Sept.3,50 h',
      'Woche 37, 7. Sept. – 13. Sept.0,00 h',
      'Woche 38, 14. Sept. – 20. Sept.0,00 h',
      'Woche 39, 21. Sept. – 27. Sept.5,50 h',
      'Woche 40, 28. Sept. – 30. Sept.noch offen',
    ])
  })

  test('shows hours per customer and opens a customer on the Time tracking page', async () => {
    const { onOpenTimeTracking } = renderDashboard()
    const section = within(await screen.findByRole('region', { name: 'Nach Kunde · September' }))

    const buttons = section.getAllByRole('button')
    expect(buttons[0]).toHaveTextContent(/Muster GmbH5,00 h, 56 % vom GesamtwertWebsite, Shop · 452,50\s€/)
    expect(buttons[1]).toHaveTextContent(/Berger4,00 h, 44 % vom GesamtwertPflege · 340,00\s€/)

    await userEvent.click(buttons[1])
    expect(onOpenTimeTracking).toHaveBeenCalledWith(2)
  })

  test('shows the billing table with PDF previews and the reports of last month that are not sent', async () => {
    const { onOpenReports } = renderDashboard()
    const table = await screen.findByRole('table', { name: 'Abrechnung · September 2026' })

    const [, first, , total] = within(table).getAllByRole('row')
    expect(first).toHaveTextContent(/Muster GmbH25,00 h80,00\s€\/h, 95,00\s€\/h452,50\s€PDF ansehen/)
    expect(total).toHaveTextContent(/Gesamt9,00 h792,50\s€/)
    const preview = within(first).getByRole('link', { name: 'PDF ansehen für Muster GmbH (öffnet in einem neuen Tab)' })
    expect(preview).toHaveAttribute('href', expect.stringMatching(/\/reports\/customer\/1\/pdf\?month=9&year=2026&lang=de&tz=[^&]+&inline=1$/))
    expect(preview).toHaveAttribute('target', '_blank')

    expect(screen.getByText('August: 1 von 2 Abrechnungen verschickt.')).toBeInTheDocument()
    expect(screen.getByText('Muster GmbH: bereit zum Versand')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Abrechnung für Muster GmbH öffnen' }))
    expect(onOpenReports).toHaveBeenCalledWith(1, 8, 2026)
  })

  test('lists recent entries; selecting one opens its customer and project, View all the newest customer', async () => {
    const { onOpenTimeTracking } = renderDashboard()
    const section = within(await screen.findByRole('region', { name: 'Letzte Einträge' }))

    expect(section.getByRole('button', { name: /Updates.*Berger · Pflege.*4,00 h/ })).toBeInTheDocument()
    expect(section.getByRole('button', { name: /Ohne Beschreibung.*Muster GmbH · Shop/ })).toBeInTheDocument()

    await userEvent.click(section.getByRole('button', { name: /Ohne Beschreibung/ }))
    expect(onOpenTimeTracking).toHaveBeenCalledWith(1, 8)
    await userEvent.click(section.getByRole('button', { name: 'Alle ansehen' }))
    expect(onOpenTimeTracking).toHaveBeenLastCalledWith(2)
  })

  test('Monthly reports opens the Reports page', async () => {
    const { onOpenReports } = renderDashboard()
    await loaded()

    await userEvent.click(screen.getByRole('button', { name: 'Monatsabrechnungen' }))
    expect(onOpenReports).toHaveBeenCalledWith()
  })

  test('starts the timer for the chosen project, preselecting the project of the newest entry', async () => {
    const timer = stoppedTimer()
    timer.start.mockResolvedValue({ id: 50 })
    renderDashboard(timer)
    await loaded()
    const select = screen.getByLabelText('Kunde und Projekt')
    expect(select).toHaveValue('9')
    expect(select).toHaveClass('appearance-none', 'pr-11')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Berger · Pflege', 'Muster GmbH · Shop', 'Muster GmbH · Website',
    ])

    await userEvent.selectOptions(select, 'Muster GmbH · Website')
    await userEvent.type(within(screen.getByRole('tabpanel', { name: 'Timer' })).getByLabelText('Beschreibung (optional)'), 'Konzept')
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))

    expect(timer.start).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, name: 'Website' }), 'Konzept', { id: 1, name: 'Muster GmbH' }
    )
  })

  test('stopping the running timer confirms the saved hours and reloads', async () => {
    const running = { id: 50, ...muster, project_id: 7, project_name: 'Website', start_time: new Date(2026, 8, 24, 13, 30).toISOString(), description: null }
    const timer = { ...stoppedTimer(), activeEntry: running }
    timer.stop.mockResolvedValue({ ...running, end_time: new Date(2026, 8, 24, 15, 0).toISOString() })
    const { rerender, onOpenTimeTracking, onOpenReports } = renderDashboard(timer)
    await loaded()
    expect(screen.queryByLabelText('Kunde und Projekt')).not.toBeInTheDocument()
    expect(screen.getByText('Läuft seit 13:30')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
    rerender(<Dashboard timer={{ ...timer, activeEntry: null }} onOpenTimeTracking={onOpenTimeTracking} onOpenReports={onOpenReports} />)

    expect(await screen.findByText('1,50 h für Website gespeichert.')).toBeInTheDocument()
    expect(api.getDashboard).toHaveBeenCalledTimes(2)
  })

  test('adds a manual entry in the second tab and reloads', async () => {
    api.createTimeEntry.mockResolvedValue({ id: 60 })
    renderDashboard()
    await loaded()

    await userEvent.click(screen.getByRole('tab', { name: 'Nachtragen' }))
    const panel = within(screen.getByRole('tabpanel', { name: 'Nachtragen' }))
    await userEvent.selectOptions(panel.getByLabelText('Projekt'), 'Muster GmbH · Shop')
    await userEvent.clear(panel.getByLabelText('Datum'))
    await userEvent.type(panel.getByLabelText('Datum'), '2026-09-23')
    await userEvent.type(panel.getByLabelText('Start'), '08:00')
    await userEvent.type(panel.getByLabelText('Ende'), '09:15')
    await userEvent.click(panel.getByRole('button', { name: 'Hinzufügen' }))

    expect(api.createTimeEntry).toHaveBeenCalledWith(8, fromInputs('2026-09-23', '08:00'), '', fromInputs('2026-09-23', '09:15'))
    expect(api.getDashboard).toHaveBeenCalledTimes(2)
  })

  test('asks for a project first when there is none', async () => {
    api.getDashboard.mockResolvedValue({ ...data, entries: [], recent: [], projects: [], lastMonthReports: { month: 8, year: 2026, reports: [] } })
    renderDashboard()

    expect(await screen.findByText('Lege zuerst auf der Seite Zeiterfassung einen Kunden und ein Projekt an.')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getByText('Keine Einträge im August')).toBeInTheDocument()
    expect(screen.getByText('Noch keine Einträge.')).toBeInTheDocument()
  })

  test('shows an error with a retry button when loading fails', async () => {
    api.getDashboard.mockRejectedValueOnce(new ApiError(0, 'unreachable'))
    renderDashboard()

    expect(await screen.findByRole('alert')).toHaveTextContent('Dashboard konnte nicht geladen werden. Der Server ist nicht erreichbar.')
    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await loaded()).toBeInTheDocument()
  })

  test('has no detectable accessibility violations', async () => {
    const { container } = renderDashboard()
    await loaded()

    expect(await axe(container)).toHaveNoViolations()
  })
})
