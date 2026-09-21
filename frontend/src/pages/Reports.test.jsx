import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '../test/render'
import userEvent from '@testing-library/user-event'
import Reports from './Reports'
import { api, ApiError } from '../api'
import { switchLocale } from '../i18n'

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { getMonthlyReport: vi.fn(), downloadPDF: vi.fn() },
}))

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('Reports', () => {
  test('shows an error when the report fails to load', async () => {
    api.getMonthlyReport.mockRejectedValue(new ApiError(500, 'boom'))
    render(<Reports customers={[{ id: 1, name: 'Muster GmbH' }]} />)

    await userEvent.selectOptions(screen.getAllByRole('combobox')[0], '1')
    await userEvent.click(screen.getByRole('button', { name: 'Bericht anzeigen' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Bericht konnte nicht geladen werden.')
    expect(screen.getByRole('button', { name: 'Bericht anzeigen' })).toBeEnabled()
  })

  test('shows the report in English with English month names and formats', async () => {
    switchLocale('en')
    api.getMonthlyReport.mockResolvedValue({
      entries: [{ id: 1, start_time: '2026-09-21T08:00:00Z', end_time: '2026-09-21T09:30:00Z', project_name: 'Website', description: 'Konzept' }],
      totalHours: '1.50',
    })
    render(<Reports customers={[{ id: 1, name: 'Muster GmbH' }]} />)

    expect(screen.getByRole('option', { name: 'September' })).toBeInTheDocument()
    await userEvent.selectOptions(screen.getAllByRole('combobox')[0], '1')
    await userEvent.selectOptions(screen.getAllByRole('combobox')[1], '9')
    await userEvent.selectOptions(screen.getAllByRole('combobox')[2], '2026')
    await userEvent.click(screen.getByRole('button', { name: 'Show report' }))

    expect(await screen.findByRole('heading', { name: 'Report Muster GmbH – September 2026' })).toBeInTheDocument()
    expect(screen.getAllByText('1.50 h')).toHaveLength(2)
    expect(screen.getByText('9/21/2026')).toBeInTheDocument()
    expect(screen.getByText('TOTAL HOURS:')).toBeInTheDocument()
  })

  test('shows German month names and formats in German', async () => {
    api.getMonthlyReport.mockResolvedValue({
      entries: [{ id: 1, start_time: '2026-03-02T08:00:00Z', end_time: '2026-03-02T09:30:00Z', project_name: 'Website', description: null }],
      totalHours: '1.50',
    })
    render(<Reports customers={[{ id: 1, name: 'Muster GmbH' }]} />)

    expect(screen.getByRole('option', { name: 'März' })).toBeInTheDocument()
    await userEvent.selectOptions(screen.getAllByRole('combobox')[0], '1')
    await userEvent.selectOptions(screen.getAllByRole('combobox')[1], '3')
    await userEvent.selectOptions(screen.getAllByRole('combobox')[2], '2026')
    await userEvent.click(screen.getByRole('button', { name: 'Bericht anzeigen' }))

    expect(await screen.findByRole('heading', { name: 'Abrechnung Muster GmbH – März 2026' })).toBeInTheDocument()
    expect(screen.getByText('GESAMTSTUNDEN:')).toBeInTheDocument()
    expect(screen.getAllByText('1,50 h')).toHaveLength(2)
    expect(screen.getByText('2.3.2026')).toBeInTheDocument()
  })

  test('downloads the PDF in the current language', async () => {
    switchLocale('en')
    api.getMonthlyReport.mockResolvedValue({ entries: [], totalHours: '0.00' })
    render(<Reports customers={[{ id: 1, name: 'Muster GmbH' }]} />)

    await userEvent.selectOptions(screen.getAllByRole('combobox')[0], '1')
    await userEvent.click(screen.getByRole('button', { name: 'Show report' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Download PDF' }))

    expect(api.downloadPDF).toHaveBeenCalledWith(1, expect.any(Number), expect.any(Number), 'en')
  })
})
