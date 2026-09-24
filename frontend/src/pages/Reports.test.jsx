import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, within } from '../test/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../test/axe'
import Reports from './Reports'
import { api, ApiError } from '../api'
import { switchLocale } from '../i18n'

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { getMonthlyReport: vi.fn(), downloadPDF: vi.fn(), setReportStatus: vi.fn() },
}))

const customers = [{ id: 1, name: 'Muster GmbH' }, { id: 2, name: 'Neu AG' }]
const report = {
  entries: [
    { id: 2, project_id: 7, project_name: 'Website', hourly_rate: '95.00', start_time: '2026-09-21T08:00:00Z', end_time: '2026-09-21T09:30:00Z', description: 'Konzept' },
    { id: 1, project_id: 8, project_name: 'Wartung', hourly_rate: '80.00', start_time: '2026-09-17T08:00:00Z', end_time: '2026-09-17T09:00:00Z', description: null },
  ],
  totalHours: '2.50',
}

async function selectCustomer(name) {
  await userEvent.selectOptions(screen.getByLabelText(/Kunde|Customer/), name)
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  // Only the date is fake, so the report opens in September 2026; userEvent still needs real timers
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 22, 12, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Reports', () => {
  test('asks for a customer first', () => {
    render(<Reports customers={customers} />)

    expect(screen.getByText('Wähle einen Kunden, um den Bericht zu sehen.')).toBeInTheDocument()
    expect(api.getMonthlyReport).not.toHaveBeenCalled()
  })

  test('loads the report of the current month as soon as a customer is selected', async () => {
    api.getMonthlyReport.mockResolvedValue(report)
    render(<Reports customers={customers} />)

    await selectCustomer('Muster GmbH')

    expect(api.getMonthlyReport).toHaveBeenCalledWith(1, 9, 2026)
    expect(await screen.findByRole('heading', { name: 'Abrechnung Muster GmbH – September 2026' })).toBeInTheDocument()
  })

  test('opens with the customer it is given', async () => {
    api.getMonthlyReport.mockResolvedValue(report)
    render(<Reports customers={customers} initialCustomerId={2} />)

    expect(screen.getByLabelText('Kunde')).toHaveValue('2')
    expect(await screen.findByRole('heading', { name: 'Abrechnung Neu AG – September 2026' })).toBeInTheDocument()
    expect(api.getMonthlyReport).toHaveBeenCalledWith(2, 9, 2026)
  })

  test('opens with the month it is given', async () => {
    api.getMonthlyReport.mockResolvedValue(report)
    render(<Reports customers={customers} initialCustomerId={1} initialMonth={8} initialYear={2026} />)

    expect(screen.getByRole('group', { name: 'Monat' })).toHaveTextContent('August 2026')
    expect(api.getMonthlyReport).toHaveBeenCalledWith(1, 8, 2026)
  })

  test('shows the status of the report and saves a new one', async () => {
    api.getMonthlyReport.mockResolvedValue({ ...report, status: 'ready' })
    api.setReportStatus.mockResolvedValue({ customer_id: 1, month: 9, year: 2026, status: 'sent' })
    render(<Reports customers={customers} initialCustomerId={1} />)
    const status = await screen.findByLabelText('Status')
    expect(status).toHaveValue('ready')
    expect([...status.options].map((o) => o.textContent)).toEqual(['Entwurf', 'Bereit zum Versand', 'Verschickt'])

    await userEvent.selectOptions(status, 'Verschickt')

    expect(api.setReportStatus).toHaveBeenCalledWith(1, 9, 2026, 'sent')
    expect(status).toHaveValue('sent')
  })

  test('keeps the status and shows an error when saving it fails', async () => {
    api.getMonthlyReport.mockResolvedValue({ ...report, status: 'draft' })
    api.setReportStatus.mockRejectedValue(new ApiError(500, 'boom'))
    render(<Reports customers={customers} initialCustomerId={1} />)
    const status = await screen.findByLabelText('Status')

    await userEvent.selectOptions(status, 'Verschickt')

    expect(await screen.findByRole('alert')).toHaveTextContent('Status der Abrechnung konnte nicht gespeichert werden.')
    expect(status).toHaveValue('draft')
  })

  test('shows no status for a month without entries', async () => {
    api.getMonthlyReport.mockResolvedValue({ entries: [], totalHours: '0.00', status: 'draft' })
    render(<Reports customers={customers} initialCustomerId={1} />)

    expect(await screen.findByText('Keine Einträge für diesen Zeitraum')).toBeInTheDocument()
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
  })

  test('steps through the months, across the turn of the year', async () => {
    api.getMonthlyReport.mockResolvedValue({ entries: [], totalHours: '0.00' })
    render(<Reports customers={customers} initialCustomerId={1} />)
    const month = screen.getByRole('group', { name: 'Monat' })

    await userEvent.click(within(month).getByRole('button', { name: 'Nächster Monat' }))
    expect(month).toHaveTextContent('Oktober 2026')
    expect(api.getMonthlyReport).toHaveBeenLastCalledWith(1, 10, 2026)

    for (let i = 0; i < 10; i++) await userEvent.click(within(month).getByRole('button', { name: 'Vorheriger Monat' }))
    expect(month).toHaveTextContent('Dezember 2025')
    expect(api.getMonthlyReport).toHaveBeenLastCalledWith(1, 12, 2025)
    expect(await screen.findByText('Keine Einträge für diesen Zeitraum')).toBeInTheDocument()
  })

  test('hides the old report while the next one loads', async () => {
    api.getMonthlyReport.mockResolvedValueOnce(report).mockReturnValueOnce(new Promise(() => {}))
    render(<Reports customers={customers} initialCustomerId={1} />)
    await screen.findByText('Konzept')

    await selectCustomer('Neu AG')

    expect(screen.queryByText('Konzept')).not.toBeInTheDocument()
    expect(screen.getByText('Laden...')).toBeInTheDocument()
  })

  test('shows an error when the report fails to load', async () => {
    api.getMonthlyReport.mockRejectedValue(new ApiError(500, 'boom'))
    render(<Reports customers={customers} />)

    await selectCustomer('Muster GmbH')

    expect(await screen.findByRole('alert')).toHaveTextContent('Bericht konnte nicht geladen werden.')
  })

  test('shows hours and amounts per entry and in total, in German', async () => {
    api.getMonthlyReport.mockResolvedValue(report)
    render(<Reports customers={customers} initialCustomerId={1} />)

    const table = await screen.findByRole('table', { name: 'Abrechnung Muster GmbH – September 2026' })
    const rows = within(table).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('21.9.2026WebsiteKonzept1,50 h142,50 €')
    expect(rows[2]).toHaveTextContent('17.9.2026Wartung—1,00 h80,00 €')
    expect(rows[3]).toHaveTextContent('Gesamt2,50 h222,50 €')
    expect(screen.getByText('Gesamtstunden').nextElementSibling).toHaveTextContent('2,50 h')
    expect(screen.getByText('Betrag (netto)').nextElementSibling).toHaveTextContent('222,50 €')
    expect(screen.getByText('Website · 1,50 h')).toBeInTheDocument()
  })

  test('shows the report in English with English month names and formats', async () => {
    switchLocale('en')
    api.getMonthlyReport.mockResolvedValue(report)
    render(<Reports customers={customers} initialCustomerId={1} />)

    expect(await screen.findByRole('heading', { name: 'Report Muster GmbH – September 2026' })).toBeInTheDocument()
    expect(screen.getByText('9/21/2026')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Total/ })).toHaveTextContent('Total2.50 h€222.50')
  })

  test('downloads the PDF in the current language, only when there are entries', async () => {
    switchLocale('en')
    api.getMonthlyReport.mockResolvedValueOnce({ entries: [], totalHours: '0.00' }).mockResolvedValueOnce(report)
    render(<Reports customers={customers} initialCustomerId={1} />)
    await screen.findByText('No entries for this period')
    expect(screen.queryByRole('button', { name: 'Download PDF' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Next month' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Download PDF' }))

    expect(api.downloadPDF).toHaveBeenCalledWith(1, 10, 2026, 'en')
  })

  test('has no detectable accessibility violations', async () => {
    api.getMonthlyReport.mockResolvedValue(report)
    const { container } = render(<Reports customers={customers} initialCustomerId={1} />)
    await screen.findByText('Konzept')

    expect(await axe(container)).toHaveNoViolations()
  })
})
