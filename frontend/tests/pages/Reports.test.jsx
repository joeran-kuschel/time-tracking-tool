import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor, within } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import Reports from '@/pages/Reports'
import { api, ApiError } from '@/api'
import { switchLocale } from '@/i18n'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { getMonthlyReport: vi.fn(), downloadPDF: vi.fn(), downloadCSV: vi.fn(), setReportStatus: vi.fn() },
}))

const customers = [{ id: 1, name: 'Muster GmbH' }, { id: 2, name: 'Neu AG' }]
const report = {
  entries: [
    { id: 2, project_id: 7, project_name: 'Website', hourly_rate: '95.00', start_time: '2026-09-21T08:00:00Z', end_time: '2026-09-21T09:30:00Z', description: 'Konzept' },
    { id: 1, project_id: 8, project_name: 'Wartung', hourly_rate: '80.00', start_time: '2026-09-17T08:00:00Z', end_time: '2026-09-17T09:00:00Z', description: null },
  ],
  totalHours: '2.50',
}
// The same report as the backend answers it with amounts=1
const reportWithAmounts = {
  ...report,
  entries: [{ ...report.entries[0], amount: '142.50' }, { ...report.entries[1], amount: '80.00' }],
  currency: 'EUR',
  totalAmount: '222.50',
  projects: [
    { projectId: 7, name: 'Website', hours: '1.50', hourlyRate: '95.00', amount: '142.50' },
    { projectId: 8, name: 'Wartung', hours: '1.00', hourlyRate: '80.00', amount: '80.00' },
  ],
}
// Answers like the backend: with amounts only when asked for
const answer = (customerId, month, year, amounts) => Promise.resolve(amounts ? reportWithAmounts : report)

async function selectCustomer(name) {
  await userEvent.selectOptions(screen.getByLabelText(/Kunde|Customer/), name)
}

beforeEach(() => {
  window.localStorage.clear()
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

    expect(api.getMonthlyReport).toHaveBeenCalledWith(1, 9, 2026, false)
    expect(await screen.findByRole('heading', { name: 'Abrechnung Muster GmbH – September 2026' })).toBeInTheDocument()
  })

  test('opens with the customer it is given', async () => {
    api.getMonthlyReport.mockResolvedValue(report)
    render(<Reports customers={customers} initialCustomerId={2} />)

    expect(screen.getByLabelText('Kunde')).toHaveValue('2')
    expect(await screen.findByRole('heading', { name: 'Abrechnung Neu AG – September 2026' })).toBeInTheDocument()
    expect(api.getMonthlyReport).toHaveBeenCalledWith(2, 9, 2026, false)
  })

  test('opens with the month it is given', async () => {
    api.getMonthlyReport.mockResolvedValue(report)
    render(<Reports customers={customers} initialCustomerId={1} initialMonth={8} initialYear={2026} />)

    expect(screen.getByRole('group', { name: 'Monat' })).toHaveTextContent('August 2026')
    expect(api.getMonthlyReport).toHaveBeenCalledWith(1, 8, 2026, false)
  })

  test('shows the status of the report and saves a new one', async () => {
    api.getMonthlyReport.mockResolvedValue({ ...report, status: 'ready' })
    api.setReportStatus.mockResolvedValue({ customer_id: 1, month: 9, year: 2026, status: 'sent' })
    render(<Reports customers={customers} initialCustomerId={1} />)
    const status = await screen.findByLabelText('Status')
    expect(status).toHaveValue('ready')
    expect(status).toHaveClass('appearance-none', 'pr-11')
    expect(screen.getByLabelText(/Kunde|Customer/)).toHaveClass('appearance-none', 'pr-11')
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
    expect(api.getMonthlyReport).toHaveBeenLastCalledWith(1, 10, 2026, false)

    for (let i = 0; i < 10; i++) await userEvent.click(within(month).getByRole('button', { name: 'Vorheriger Monat' }))
    expect(month).toHaveTextContent('Dezember 2025')
    expect(api.getMonthlyReport).toHaveBeenLastCalledWith(1, 12, 2025, false)
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

  test('shows hours per entry, per project and in total without amounts by default, in German', async () => {
    api.getMonthlyReport.mockImplementation(answer)
    render(<Reports customers={customers} initialCustomerId={1} />)

    const table = await screen.findByRole('table', { name: 'Abrechnung Muster GmbH – September 2026' })
    const rows = within(table).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('21.9.2026WebsiteKonzept1,50 h')
    expect(rows[1]).not.toHaveTextContent('€')
    expect(rows[2]).toHaveTextContent('17.9.2026Wartung—1,00 h')
    expect(rows[3]).toHaveTextContent('Gesamt2,50 h')
    expect(rows[3]).not.toHaveTextContent('€')
    expect(within(table).queryByRole('columnheader', { name: 'Betrag' })).not.toBeInTheDocument()
    expect(screen.getByText('Gesamtstunden').nextElementSibling).toHaveTextContent('2,50 h')
    expect(screen.queryByText('Betrag (netto)')).not.toBeInTheDocument()
    expect(screen.getByText('Website · 1,50 h')).toBeInTheDocument()
    expect(screen.getByText('Wartung · 1,00 h')).toBeInTheDocument()
  })

  test('shows hourly rates and amounts per entry, per project and in total after ticking the box, in German', async () => {
    api.getMonthlyReport.mockImplementation(answer)
    render(<Reports customers={customers} initialCustomerId={1} />)
    await screen.findByText('Konzept')

    await userEvent.click(screen.getByLabelText('Stundensatz und Beträge anzeigen'))

    const table = await screen.findByRole('table', { name: 'Abrechnung Muster GmbH – September 2026' })
    const rows = within(table).getAllByRole('row')
    expect(within(table).getByRole('columnheader', { name: 'Betrag' })).toBeInTheDocument()
    expect(rows[1]).toHaveTextContent('21.9.2026WebsiteKonzept1,50 h142,50 €')
    expect(rows[2]).toHaveTextContent('17.9.2026Wartung—1,00 h80,00 €')
    expect(rows[3]).toHaveTextContent('Gesamt2,50 h222,50 €')
    expect(screen.getByText('Gesamtstunden').nextElementSibling).toHaveTextContent('2,50 h')
    expect(screen.getByText('Betrag (netto)').nextElementSibling).toHaveTextContent('222,50 €')
    expect(screen.getByText('Website · 1,50 h · 95,00 €/h · 142,50 €')).toBeInTheDocument()
    expect(screen.getByText('Wartung · 1,00 h · 80,00 €/h · 80,00 €')).toBeInTheDocument()
  })

  test('shows the report in English with English month names and formats', async () => {
    switchLocale('en')
    window.localStorage.setItem('reportAmounts', 'true')
    api.getMonthlyReport.mockImplementation(answer)
    render(<Reports customers={customers} initialCustomerId={1} />)

    expect(await screen.findByRole('heading', { name: 'Report Muster GmbH – September 2026' })).toBeInTheDocument()
    expect(screen.getByText('9/21/2026')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Total/ })).toHaveTextContent('Total2.50 h€222.50')
    expect(screen.getByText('Website · 1.50 h · €95.00/h · €142.50')).toBeInTheDocument()
    expect(screen.getByLabelText('Show hourly rate and amounts')).toBeChecked()
  })

  test('shows the server\'s amounts as they are, without float errors, and hours rounded like the PDF', async () => {
    const entry = (id, minutes, rate, amount) => ({
      id, project_id: 9, project_name: 'Support', hourly_rate: rate, description: `E${id}`,
      start_time: '2026-09-21T08:00:00Z', end_time: new Date(Date.UTC(2026, 8, 21, 8, minutes)).toISOString(), amount,
    })
    // 7 min = 0.12 h and 13 min = 0.22 h when rounded to hundredths, together 0.34 h (unrounded 0.3333 h)
    const rounded = {
      entries: [entry(1, 7, '99.99', '12.00'), entry(2, 13, '99.99', '22.00')],
      currency: 'EUR',
      totalAmount: '34.00',
      projects: [{ projectId: 9, name: 'Support', hours: '0.34', hourlyRate: '99.99', amount: '34.00' }],
    }
    api.getMonthlyReport.mockResolvedValue(rounded)
    window.localStorage.setItem('reportAmounts', 'true')
    render(<Reports customers={customers} initialCustomerId={1} />)

    expect(await screen.findByText('Support · 0,34 h · 99,99 €/h · 34,00 €')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Gesamt/ })).toHaveTextContent('Gesamt0,34 h34,00 €')
    expect(screen.getByText('E1').closest('tr')).toHaveTextContent('0,12 h12,00 €')
  })

  test.each([false, true])('rounds hours like the PDF (toFixed(2)): an entry of exactly +18 s and one of -18 s, option on: %s', async (on) => {
    const at = (seconds) => new Date(Date.UTC(2026, 8, 21, 8, 0, 0) + seconds * 1000).toISOString()
    const entry = (id, project, seconds, amount) => ({
      id, project_id: project, project_name: `P${project}`, hourly_rate: '80.00', description: `E${id}`,
      start_time: at(0), end_time: at(seconds), amount,
    })
    const data = { entries: [entry(1, 1, 18, '0.80'), entry(2, 2, -18, '0.00')], totalHours: '0.00' }
    if (on) {
      Object.assign(data, {
        totalAmount: '0.80',
        projects: [
          { projectId: 1, name: 'P1', hours: '0.01', hourlyRate: '80.00', amount: '0.80' },
          { projectId: 2, name: 'P2', hours: '0.00', hourlyRate: '80.00', amount: '0.00' },
        ],
      })
    }
    api.getMonthlyReport.mockResolvedValue(data)
    window.localStorage.setItem('reportAmounts', String(on))
    render(<Reports customers={customers} initialCustomerId={1} />)

    expect((await screen.findByText('E1')).closest('tr')).toHaveTextContent('0,01 h')
    expect(screen.getByText('E2').closest('tr')).toHaveTextContent('-0,01 h')
    expect(screen.getByRole('row', { name: /Gesamt/ })).toHaveTextContent('Gesamt0,00 h')
    expect(screen.getByText(/^P1 · 0,01 h/)).toBeInTheDocument()
    expect(screen.getByText(/^P2 · 0,00 h/)).toBeInTheDocument()
  })

  test.each([false, true])('counts an entry that ends before it starts as 0 hours in the project line, option on: %s', async (on) => {
    const entry = (id, start, end, amount) => ({
      id, project_id: 5, project_name: 'Mix', hourly_rate: '80.00', description: `E${id}`,
      start_time: `2026-09-21T${start}:00Z`, end_time: `2026-09-21T${end}:00Z`, amount,
    })
    const data = { entries: [entry(1, '08:00', '09:00', '80.00'), entry(2, '12:00', '10:30', '0.00')], totalHours: '-0.50' }
    if (on) {
      Object.assign(data, {
        totalAmount: '80.00',
        projects: [{ projectId: 5, name: 'Mix', hours: '1.00', hourlyRate: '80.00', amount: '80.00' }],
      })
    }
    api.getMonthlyReport.mockResolvedValue(data)
    window.localStorage.setItem('reportAmounts', String(on))
    render(<Reports customers={customers} initialCustomerId={1} />)

    expect(await screen.findByText(/^Mix · 1,00 h/)).toBeInTheDocument()
    expect(screen.getByText('E2').closest('tr')).toHaveTextContent('-1,50 h')
    expect(screen.getByRole('row', { name: /Gesamt/ })).toHaveTextContent('Gesamt-0,50 h')
    expect(screen.getByText('Gesamtstunden').nextElementSibling).toHaveTextContent('-0,50 h')
  })

  test('counts a running entry as 0 hours', async () => {
    const running = { id: 3, project_id: 7, project_name: 'Website', hourly_rate: '80.00', start_time: '2026-09-22T08:00:00Z', end_time: null, description: 'läuft', amount: '0.00' }
    api.getMonthlyReport.mockResolvedValue({ entries: [running], totalHours: '0.00' })
    render(<Reports customers={customers} initialCustomerId={1} />)

    expect(await screen.findByText('Website · 0,00 h')).toBeInTheDocument()
    expect(screen.getByText('Gesamtstunden').nextElementSibling).toHaveTextContent('0,00 h')
  })

  test('has the same total hours with and without amounts', async () => {
    api.getMonthlyReport.mockImplementation(answer)
    render(<Reports customers={customers} initialCustomerId={1} />)
    await screen.findByText('Konzept')
    const total = () => screen.getByText('Gesamtstunden').nextElementSibling.textContent
    const without = total()

    await userEvent.click(screen.getByLabelText('Stundensatz und Beträge anzeigen'))
    await screen.findByText('Betrag (netto)')

    expect(total()).toBe(without)
  })

  describe('the amounts option', () => {
    const optionLabel = 'Stundensatz und Beträge anzeigen'

    test('is a native checkbox that is off by default and only shown once a customer is chosen', async () => {
      api.getMonthlyReport.mockImplementation(answer)
      render(<Reports customers={customers} />)
      expect(screen.queryByLabelText(optionLabel)).not.toBeInTheDocument()

      await selectCustomer('Muster GmbH')

      const box = await screen.findByLabelText(optionLabel)
      expect(box).toHaveAttribute('type', 'checkbox')
      expect(box).not.toBeChecked()
      expect(box.closest('label')).toHaveClass('min-h-[2.75rem]')
    })

    test('is also shown for a month without entries', async () => {
      api.getMonthlyReport.mockResolvedValue({ entries: [], totalHours: '0.00' })
      render(<Reports customers={customers} initialCustomerId={1} />)

      expect(await screen.findByText('Keine Einträge für diesen Zeitraum')).toBeInTheDocument()
      expect(screen.getByLabelText(optionLabel)).toBeInTheDocument()
    })

    test('asks for amounts when ticked and for none when unticked again', async () => {
      api.getMonthlyReport.mockImplementation(answer)
      render(<Reports customers={customers} initialCustomerId={1} />)
      const box = await screen.findByLabelText(optionLabel)
      expect(api.getMonthlyReport).toHaveBeenLastCalledWith(1, 9, 2026, false)

      await userEvent.click(box)
      await screen.findByText('Betrag (netto)')
      expect(api.getMonthlyReport).toHaveBeenLastCalledWith(1, 9, 2026, true)

      await userEvent.click(box)
      await waitFor(() => expect(screen.queryByText('Betrag (netto)')).not.toBeInTheDocument())
      expect(api.getMonthlyReport).toHaveBeenLastCalledWith(1, 9, 2026, false)
    })

    test('keeps the focus on the checkbox after toggling', async () => {
      api.getMonthlyReport.mockImplementation(answer)
      render(<Reports customers={customers} initialCustomerId={1} />)
      const box = await screen.findByLabelText(optionLabel)
      box.focus()

      await userEvent.keyboard(' ')
      await screen.findByText('Betrag (netto)')

      expect(box).toBeChecked()
      expect(screen.getByLabelText(optionLabel)).toBe(box)
      expect(box).toHaveFocus()
    })

    test('is saved in the browser and restored', async () => {
      api.getMonthlyReport.mockImplementation(answer)
      const { unmount } = render(<Reports customers={customers} initialCustomerId={1} />)
      await userEvent.click(await screen.findByLabelText(optionLabel))
      expect(window.localStorage.getItem('reportAmounts')).toBe('true')
      unmount()

      render(<Reports customers={customers} initialCustomerId={1} />)

      expect(await screen.findByLabelText(optionLabel)).toBeChecked()
      expect(api.getMonthlyReport).toHaveBeenLastCalledWith(1, 9, 2026, true)
      expect(await screen.findByText('Betrag (netto)')).toBeInTheDocument()
    })

    test('keeps working when the browser blocks its storage', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
      api.getMonthlyReport.mockImplementation(answer)
      render(<Reports customers={customers} initialCustomerId={1} />)
      const box = await screen.findByLabelText(optionLabel)
      expect(box).not.toBeChecked()

      await userEvent.click(box)

      expect(box).toBeChecked()
      expect(await screen.findByText('Betrag (netto)')).toBeInTheDocument()
    })

    test('leaves the report status as it is', async () => {
      api.getMonthlyReport.mockImplementation((...args) => answer(...args).then((data) => ({ ...data, status: 'ready' })))
      render(<Reports customers={customers} initialCustomerId={1} />)
      await screen.findByLabelText('Status')

      await userEvent.click(screen.getByLabelText(optionLabel))

      await screen.findByText('Betrag (netto)')
      expect(screen.getByLabelText('Status')).toHaveValue('ready')
      expect(api.setReportStatus).not.toHaveBeenCalled()
    })

    test('passes the choice to the PDF and the CSV download', async () => {
      api.getMonthlyReport.mockImplementation(answer)
      render(<Reports customers={customers} initialCustomerId={1} />)
      await userEvent.click(await screen.findByRole('button', { name: 'PDF herunterladen' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'PDF herunterladen' })).toHaveAttribute('aria-disabled', 'false'))
      await userEvent.click(screen.getByRole('button', { name: 'CSV herunterladen' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'CSV herunterladen' })).toHaveAttribute('aria-disabled', 'false'))
      expect(api.downloadPDF).toHaveBeenLastCalledWith(1, 9, 2026, 'de', false)
      expect(api.downloadCSV).toHaveBeenLastCalledWith(1, 9, 2026, 'de', false)

      await userEvent.click(screen.getByLabelText(optionLabel))
      await userEvent.click(await screen.findByRole('button', { name: 'PDF herunterladen' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'PDF herunterladen' })).toHaveAttribute('aria-disabled', 'false'))
      await userEvent.click(screen.getByRole('button', { name: 'CSV herunterladen' }))

      expect(api.downloadPDF).toHaveBeenLastCalledWith(1, 9, 2026, 'de', true)
      expect(api.downloadCSV).toHaveBeenLastCalledWith(1, 9, 2026, 'de', true)
    })

    test('still shows the option after a failed load', async () => {
      api.getMonthlyReport.mockRejectedValueOnce(new ApiError(500, 'boom')).mockImplementation(answer)
      render(<Reports customers={customers} initialCustomerId={1} />)
      expect(await screen.findByRole('alert')).toHaveTextContent('Bericht konnte nicht geladen werden.')

      await userEvent.click(screen.getByLabelText(optionLabel))

      expect(await screen.findByText('Betrag (netto)')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    test('has no detectable accessibility violations with the option on', async () => {
      window.localStorage.setItem('reportAmounts', 'true')
      api.getMonthlyReport.mockImplementation(answer)
      const { container } = render(<Reports customers={customers} initialCustomerId={1} />)
      await screen.findByText('Betrag (netto)')

      expect(await axe(container)).toHaveNoViolations()
    })
  })

  test('downloads the PDF in the current language, only when there are entries', async () => {
    switchLocale('en')
    api.getMonthlyReport.mockResolvedValueOnce({ entries: [], totalHours: '0.00' }).mockResolvedValueOnce(report)
    render(<Reports customers={customers} initialCustomerId={1} />)
    await screen.findByText('No entries for this period')
    expect(screen.queryByRole('button', { name: 'Download PDF' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Next month' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Download PDF' }))

    expect(api.downloadPDF).toHaveBeenCalledWith(1, 10, 2026, 'en', false)
  })

  test('shows an error on the page when the download fails', async () => {
    api.getMonthlyReport.mockResolvedValue(report)
    api.downloadPDF.mockRejectedValue(new ApiError(500, 'Failed to generate PDF report'))
    render(<Reports customers={customers} initialCustomerId={1} />)

    await userEvent.click(await screen.findByRole('button', { name: 'PDF herunterladen' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('PDF konnte nicht heruntergeladen werden. Bitte versuche es erneut.')
  })

  test('downloads the CSV in the current language, only when there are entries', async () => {
    switchLocale('en')
    api.getMonthlyReport.mockResolvedValueOnce({ entries: [], totalHours: '0.00' }).mockResolvedValueOnce(report)
    render(<Reports customers={customers} initialCustomerId={1} />)
    await screen.findByText('No entries for this period')
    expect(screen.queryByRole('button', { name: 'Download CSV' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Next month' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Download CSV' }))

    expect(api.downloadCSV).toHaveBeenCalledWith(1, 10, 2026, 'en', false)
    expect(api.downloadPDF).not.toHaveBeenCalled()
  })

  test('names the CSV button in German', async () => {
    api.getMonthlyReport.mockResolvedValue(report)
    render(<Reports customers={customers} initialCustomerId={1} />)

    expect(await screen.findByRole('button', { name: 'CSV herunterladen' })).toBeInTheDocument()
  })

  test('shows an error on the page when the CSV download fails', async () => {
    api.getMonthlyReport.mockResolvedValue(report)
    api.downloadCSV.mockRejectedValue(new ApiError(500, 'Failed to export CSV report'))
    render(<Reports customers={customers} initialCustomerId={1} />)

    await userEvent.click(await screen.findByRole('button', { name: 'CSV herunterladen' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('CSV konnte nicht heruntergeladen werden. Bitte versuche es erneut.')
  })

  test('marks both download buttons disabled and ignores clicks while a download runs', async () => {
    api.getMonthlyReport.mockResolvedValue(report)
    let finish
    api.downloadCSV.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    render(<Reports customers={customers} initialCustomerId={1} />)
    const csv = await screen.findByRole('button', { name: 'CSV herunterladen' })
    const pdf = screen.getByRole('button', { name: 'PDF herunterladen' })
    expect(csv).toHaveAttribute('aria-disabled', 'false')

    await userEvent.click(csv)
    expect(csv).toHaveAttribute('aria-disabled', 'true')
    expect(pdf).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(pdf)
    await userEvent.click(csv)
    expect(api.downloadPDF).not.toHaveBeenCalled()
    expect(api.downloadCSV).toHaveBeenCalledTimes(1)

    finish()
    await waitFor(() => expect(csv).toHaveAttribute('aria-disabled', 'false'))
    expect(pdf).toHaveAttribute('aria-disabled', 'false')
  })

  test('enables the buttons again after a failed download', async () => {
    api.getMonthlyReport.mockResolvedValue(report)
    api.downloadPDF.mockRejectedValue(new ApiError(500, 'Failed to generate PDF report'))
    render(<Reports customers={customers} initialCustomerId={1} />)

    await userEvent.click(await screen.findByRole('button', { name: 'PDF herunterladen' }))
    await screen.findByRole('alert')

    expect(screen.getByRole('button', { name: 'CSV herunterladen' })).toHaveAttribute('aria-disabled', 'false')
  })

  test('ignores a click on CSV while the PDF downloads', async () => {
    api.getMonthlyReport.mockResolvedValue(report)
    let finish
    api.downloadPDF.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    render(<Reports customers={customers} initialCustomerId={1} />)
    const pdf = await screen.findByRole('button', { name: 'PDF herunterladen' })

    await userEvent.click(pdf)
    await userEvent.click(screen.getByRole('button', { name: 'CSV herunterladen' }))
    await userEvent.click(pdf)

    expect(api.downloadCSV).not.toHaveBeenCalled()
    expect(api.downloadPDF).toHaveBeenCalledTimes(1)
    finish()
    await waitFor(() => expect(pdf).toHaveAttribute('aria-disabled', 'false'))
  })

  test('ignores the keyboard on a busy download button and keeps focus on it', async () => {
    api.getMonthlyReport.mockResolvedValue(report)
    let finish
    api.downloadCSV.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    render(<Reports customers={customers} initialCustomerId={1} />)
    const csv = await screen.findByRole('button', { name: 'CSV herunterladen' })
    csv.focus()

    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')

    expect(api.downloadCSV).toHaveBeenCalledTimes(1)
    expect(csv).toHaveFocus()
    finish()
    await waitFor(() => expect(csv).toHaveAttribute('aria-disabled', 'false'))
  })

  test('allows a second CSV download after the first one finished', async () => {
    api.getMonthlyReport.mockResolvedValue(report)
    api.downloadCSV.mockResolvedValue(undefined)
    render(<Reports customers={customers} initialCustomerId={1} />)
    const csv = await screen.findByRole('button', { name: 'CSV herunterladen' })

    await userEvent.click(csv)
    await waitFor(() => expect(csv).toHaveAttribute('aria-disabled', 'false'))
    await userEvent.click(csv)

    expect(api.downloadCSV).toHaveBeenCalledTimes(2)
  })

  test('tells that the server is not reachable when the CSV download cannot connect', async () => {
    api.getMonthlyReport.mockResolvedValue(report)
    api.downloadCSV.mockRejectedValue(new ApiError(0, 'Network error'))
    render(<Reports customers={customers} initialCustomerId={1} />)

    await userEvent.click(await screen.findByRole('button', { name: 'CSV herunterladen' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('CSV konnte nicht heruntergeladen werden. Der Server ist nicht erreichbar.')
  })

  test('removes the CSV error when the next download succeeds', async () => {
    api.getMonthlyReport.mockResolvedValue(report)
    api.downloadCSV.mockRejectedValueOnce(new ApiError(500, 'x')).mockResolvedValueOnce(undefined)
    render(<Reports customers={customers} initialCustomerId={1} />)
    const csv = await screen.findByRole('button', { name: 'CSV herunterladen' })

    await userEvent.click(csv)
    await screen.findByRole('alert')
    await userEvent.click(csv)

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  test('has no detectable accessibility violations with the option off', async () => {
    api.getMonthlyReport.mockResolvedValue(report)
    const { container } = render(<Reports customers={customers} initialCustomerId={1} />)
    await screen.findByText('Konzept')

    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('Reports, the amounts option in edge cases', () => {
  const optionLabel = 'Stundensatz und Beträge anzeigen'
  const deferred = () => {
    let resolve, reject
    const promise = new Promise((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
  }
  const money = (entries, projects, totalAmount) => ({ entries, projects, totalAmount, currency: 'EUR' })
  const entryOf = (id, extra = {}) => ({
    id, project_id: 7, project_name: 'Website', hourly_rate: '95.00', description: `E${id}`,
    start_time: '2026-09-21T08:00:00Z', end_time: '2026-09-21T09:00:00Z', amount: '95.00', ...extra,
  })

  test('toggles when the label text is clicked and names the box in English', async () => {
    switchLocale('en')
    api.getMonthlyReport.mockImplementation(answer)
    render(<Reports customers={customers} initialCustomerId={1} />)
    await screen.findByText('Konzept')

    await userEvent.click(screen.getByText('Show hourly rate and amounts'))

    expect(screen.getByRole('checkbox', { name: 'Show hourly rate and amounts' })).toBeChecked()
    expect(await screen.findByText('Amount (net)')).toBeInTheDocument()
  })

  test.each([['de', 'Betrag (netto)'], ['en', 'Amount (net)']])('has no accessibility violations with the option on and off in %s', async (locale, amountCard) => {
    switchLocale(locale)
    api.getMonthlyReport.mockImplementation(answer)
    const { container } = render(<Reports customers={customers} initialCustomerId={1} />)
    await userEvent.click(await screen.findByRole('checkbox'))
    await screen.findByText(amountCard)
    expect(await axe(container)).toHaveNoViolations()

    await userEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(screen.queryByText(amountCard)).not.toBeInTheDocument())
    expect(await axe(container)).toHaveNoViolations()
  })

  test.each(['yes', 'false', '', '1', 'TRUE'])('starts unticked for the stored value %j', async (stored) => {
    window.localStorage.setItem('reportAmounts', stored)
    api.getMonthlyReport.mockImplementation(answer)
    render(<Reports customers={customers} initialCustomerId={1} />)

    expect(await screen.findByLabelText(optionLabel)).not.toBeChecked()
    expect(api.getMonthlyReport).toHaveBeenLastCalledWith(1, 9, 2026, false)
  })

  test('shows the answer of the last choice when the answers arrive out of order', async () => {
    const off = deferred()
    const on = deferred()
    api.getMonthlyReport.mockImplementation((c, m, y, amounts) => (amounts ? on.promise : off.promise))
    render(<Reports customers={customers} initialCustomerId={1} />)
    await userEvent.click(await screen.findByLabelText(optionLabel))
    expect(api.getMonthlyReport).toHaveBeenCalledTimes(2)

    on.resolve(reportWithAmounts)
    expect(await screen.findByText('Betrag (netto)')).toBeInTheDocument()
    off.resolve(report)
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(screen.getByText('Betrag (netto)')).toBeInTheDocument()
    expect(screen.getByLabelText(optionLabel)).toBeChecked()
  })

  test('ignores a late answer for a toggle that was undone', async () => {
    const first = deferred()
    api.getMonthlyReport.mockImplementation((c, m, y, amounts) => (amounts ? first.promise : Promise.resolve(report)))
    render(<Reports customers={customers} initialCustomerId={1} />)
    await screen.findByText('Konzept')
    await userEvent.click(screen.getByLabelText(optionLabel))
    await userEvent.click(screen.getByLabelText(optionLabel))
    await waitFor(() => expect(screen.getByText('Gesamtstunden')).toBeInTheDocument())

    first.resolve(reportWithAmounts)
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(screen.queryByText('Betrag (netto)')).not.toBeInTheDocument()
    expect(screen.getByLabelText(optionLabel)).not.toBeChecked()
  })

  test('ignores a late answer of the old month after toggling and changing the month', async () => {
    const old = deferred()
    api.getMonthlyReport.mockImplementation((c, month, y, amounts) => {
      if (month === 9 && amounts) return old.promise
      return Promise.resolve({ entries: [entryOf(5, { description: 'Oktober' })], totalHours: '1.00' })
    })
    render(<Reports customers={customers} initialCustomerId={1} />)
    await userEvent.click(await screen.findByLabelText(optionLabel))
    await userEvent.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    await screen.findByText('Oktober')

    old.resolve(reportWithAmounts)
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(screen.getByText('Oktober')).toBeInTheDocument()
    expect(screen.queryByText('Konzept')).not.toBeInTheDocument()
  })

  test('shows the error and no stale report when the reload after ticking fails, and the box stays ticked', async () => {
    api.getMonthlyReport.mockImplementation((c, m, y, amounts) =>
      amounts ? Promise.reject(new ApiError(500, 'boom')) : Promise.resolve(report))
    render(<Reports customers={customers} initialCustomerId={1} />)
    await screen.findByText('Konzept')

    await userEvent.click(screen.getByLabelText(optionLabel))

    expect(await screen.findByRole('alert')).toHaveTextContent('Bericht konnte nicht geladen werden.')
    expect(screen.queryByText('Konzept')).not.toBeInTheDocument()
    expect(screen.queryByText('Betrag (netto)')).not.toBeInTheDocument()
    expect(screen.getByLabelText(optionLabel)).toBeChecked()
  })

  test('shows no amounts for a stale report when the server leaves them out although they were asked for', async () => {
    window.localStorage.setItem('reportAmounts', 'true')
    api.getMonthlyReport.mockResolvedValue(report)
    render(<Reports customers={customers} initialCustomerId={1} />)

    expect(await screen.findByText('Website · 1,50 h')).toBeInTheDocument()
    expect(screen.queryByText('Betrag (netto)')).not.toBeInTheDocument()
  })

  test('formats rates and amounts of 1000 and more with thousands separators in both languages', async () => {
    const big = money(
      [entryOf(1, { amount: '1403.10', hourly_rate: '1403.10' })],
      [{ projectId: 7, name: 'Website', hours: '1.00', hourlyRate: '1403.10', amount: '1403.10' }],
      '1403.10',
    )
    window.localStorage.setItem('reportAmounts', 'true')
    api.getMonthlyReport.mockResolvedValue(big)
    render(<Reports customers={customers} initialCustomerId={1} />)

    expect(await screen.findByText('Website · 1,00 h · 1.403,10 €/h · 1.403,10 €')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Gesamt/ })).toHaveTextContent('Gesamt1,00 h1.403,10 €')

    switchLocale('en')
    expect(await screen.findByText('Website · 1.00 h · €1,403.10/h · €1,403.10')).toBeInTheDocument()
  })

  test('formats zero and very large amounts from the server', async () => {
    const odd = money(
      [entryOf(1, { amount: '0.00', hourly_rate: '0.00' }), entryOf(2, { project_id: 8, project_name: 'Groß', amount: '99999999.99' })],
      [
        { projectId: 7, name: 'Website', hours: '1.00', hourlyRate: '0.00', amount: '0.00' },
        { projectId: 8, name: 'Groß', hours: '1.00', hourlyRate: '99999999.99', amount: '99999999.99' },
      ],
      '99999999.99',
    )
    window.localStorage.setItem('reportAmounts', 'true')
    api.getMonthlyReport.mockResolvedValue(odd)
    render(<Reports customers={customers} initialCustomerId={1} />)

    expect(await screen.findByText('Website · 1,00 h · 0,00 €/h · 0,00 €')).toBeInTheDocument()
    expect(screen.getByText('Groß · 1,00 h · 99.999.999,99 €/h · 99.999.999,99 €')).toBeInTheDocument()
    expect(screen.getByText('Betrag (netto)').nextElementSibling).toHaveTextContent('99.999.999,99 €')
  })

  test('keeps a long project name in its line with the rate and the amount', async () => {
    const name = 'Langzeitprojekt '.repeat(12).trim()
    const long = money([entryOf(1, { project_name: name })], [{ projectId: 7, name, hours: '1.00', hourlyRate: '95.00', amount: '95.00' }], '95.00')
    window.localStorage.setItem('reportAmounts', 'true')
    api.getMonthlyReport.mockResolvedValue(long)
    render(<Reports customers={customers} initialCustomerId={1} />)

    expect(await screen.findByText(`${name} · 1,00 h · 95,00 €/h · 95,00 €`)).toBeInTheDocument()
  })

  test('sums a negative entry and a running entry the same with and without amounts', async () => {
    const entries = [
      entryOf(1),
      entryOf(2, { start_time: '2026-09-21T12:00:00Z', end_time: '2026-09-21T11:00:00Z', amount: '-95.00' }),
      entryOf(3, { start_time: '2026-09-22T08:00:00Z', end_time: null, amount: '0.00' }),
      entryOf(4, { project_id: 8, project_name: 'Wartung', start_time: '2026-09-23T08:00:00Z', end_time: '2026-09-23T08:07:00Z', amount: '11.00' }),
    ]
    const bothWays = {
      off: { entries, totalHours: '0.12' },
      on: money(entries, [
        { projectId: 7, name: 'Website', hours: '1.00', hourlyRate: '95.00', amount: '95.00' },
        { projectId: 8, name: 'Wartung', hours: '0.12', hourlyRate: '95.00', amount: '11.00' },
      ], '106.00'),
    }
    api.getMonthlyReport.mockImplementation((c, m, y, amounts) => Promise.resolve(amounts ? bothWays.on : bothWays.off))
    render(<Reports customers={customers} initialCustomerId={1} />)
    const total = () => screen.getByText('Gesamtstunden').nextElementSibling.textContent
    await screen.findByText('Website · 1,00 h')
    expect(screen.getByText('E2').closest('tr')).toHaveTextContent('-1,00 h')
    expect(screen.getByText('Wartung · 0,12 h')).toBeInTheDocument()
    const off = total()

    await userEvent.click(screen.getByLabelText(optionLabel))
    await screen.findByText('Betrag (netto)')

    expect(off).toBe('0,12 h')
    expect(total()).toBe(off)
    expect(screen.getByRole('row', { name: /Gesamt/ })).toHaveTextContent('Gesamt0,12 h106,00 €')
  })

  test('does not reset the choice when the page is opened for another customer', async () => {
    window.localStorage.setItem('reportAmounts', 'true')
    api.getMonthlyReport.mockImplementation(answer)
    render(<Reports customers={customers} initialCustomerId={1} />)
    await screen.findByText('Betrag (netto)')

    await selectCustomer('Neu AG')

    await waitFor(() => expect(api.getMonthlyReport).toHaveBeenLastCalledWith(2, 9, 2026, true))
    expect(screen.getByLabelText(optionLabel)).toBeChecked()
  })

  test('hands a download the state at the click, also when the box is ticked during it', async () => {
    const running = deferred()
    api.getMonthlyReport.mockImplementation(answer)
    api.downloadPDF.mockReturnValue(running.promise)
    render(<Reports customers={customers} initialCustomerId={1} />)
    await userEvent.click(await screen.findByRole('button', { name: 'PDF herunterladen' }))

    await userEvent.click(screen.getByLabelText(optionLabel))
    running.resolve()
    await screen.findByText('Betrag (netto)')

    expect(api.downloadPDF).toHaveBeenCalledTimes(1)
    expect(api.downloadPDF).toHaveBeenCalledWith(1, 9, 2026, 'de', false)
    expect(screen.getByLabelText(optionLabel)).toBeChecked()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('still changes the status with the box on', async () => {
    window.localStorage.setItem('reportAmounts', 'true')
    api.getMonthlyReport.mockImplementation(answer)
    api.setReportStatus.mockResolvedValue({ status: 'sent' })
    render(<Reports customers={customers} initialCustomerId={1} />)
    await screen.findByText('Betrag (netto)')

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'sent')

    expect(api.setReportStatus).toHaveBeenCalledWith(1, 9, 2026, 'sent')
    expect(screen.getByLabelText(optionLabel)).toBeChecked()
  })
})
