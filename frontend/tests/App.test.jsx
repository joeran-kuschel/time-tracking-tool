import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderWithRouter as render, screen, waitFor, within } from './support/render'
import userEvent from '@testing-library/user-event'
import { useLocation, useNavigate } from 'react-router'
import { axe } from './support/axe'
import App from '@/App'
import { api, ApiError } from '@/api'
import { fromInputs } from '@/entryTime'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: {
    getCustomers: vi.fn(),
    createCustomer: vi.fn(),
    getActiveEntry: vi.fn(),
    getProjects: vi.fn(),
    getCustomerTimeEntries: vi.fn(),
    getMonthlyReport: vi.fn(),
    deleteProject: vi.fn(),
    stopTimeEntry: vi.fn(),
    createTimeEntry: vi.fn(),
    updateCustomer: vi.fn(),
    deleteCustomer: vi.fn(),
    getDashboard: vi.fn(),
    searchTimeEntries: vi.fn(),
  },
}))

const running = {
  id: 42, project_id: 7, project_name: 'Website', customer_id: 1, customer_name: 'Muster GmbH', description: null,
  start_time: new Date().toISOString(),
}

// The running timer in the header
const runningTimer = (name = 'Laufender Timer') => screen.findByRole('region', { name })

// Opens the "new customer" dialog and returns it
async function openNewCustomer() {
  await userEvent.click(await screen.findByRole('button', { name: 'Neuer Kunde' }))
  return screen.getByRole('dialog', { name: 'Neuer Kunde' })
}

const emptyDashboard = { entries: [], recent: [], projects: [], lastMonthReports: { month: 8, year: 2026, reports: [] } }

// The app starts on the Dashboard; most tests are about the Time tracking page
async function renderTimeTracking() {
  const result = render(<App />)
  await userEvent.click(await screen.findByRole('link', { name: /^(Zeiterfassung|Time tracking)$/ }))
  return result
}

beforeEach(() => {
  vi.resetAllMocks()
  api.getDashboard.mockResolvedValue(emptyDashboard)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  api.getActiveEntry.mockResolvedValue(null)
  api.getProjects.mockResolvedValue([{ id: 7, name: 'Website', hourly_rate: '80.00' }])
  api.getCustomerTimeEntries.mockResolvedValue([])
})

describe('App', () => {
  test('has a logout button in the header that calls onLogout', async () => {
    api.getCustomers.mockResolvedValue([])
    const onLogout = vi.fn()
    render(<App onLogout={onLogout} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Abmelden' }))

    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  test('moves focus to the page content after a login, but not otherwise', async () => {
    api.getCustomers.mockResolvedValue([])
    const first = render(<App onLogout={() => {}} focusOnStart />)
    await screen.findByRole('button', { name: 'Abmelden' })
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus())
    first.unmount()

    render(<App onLogout={() => {}} />)
    await screen.findByRole('button', { name: 'Abmelden' })
    expect(screen.getByRole('main')).not.toHaveFocus()
  })

  test('shows why logging out failed', async () => {
    api.getCustomers.mockResolvedValue([])
    render(<App onLogout={() => {}} logoutError="Abmelden fehlgeschlagen. Bitte versuche es erneut." />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Abmelden fehlgeschlagen.')
  })

  test('shows an error with a retry button when customers fail to load', async () => {
    api.getCustomers.mockRejectedValue(new ApiError(0, 'unreachable'))
    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kunden konnten nicht geladen werden. Der Server ist nicht erreichbar.'
    )
    expect(await axe(document.body)).toHaveNoViolations()
  })

  test('loads the customers again on retry', async () => {
    api.getCustomers
      .mockRejectedValueOnce(new ApiError(500, 'boom'))
      .mockResolvedValueOnce([{ id: 1, name: 'Muster GmbH' }])
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }))
    await userEvent.click(screen.getByRole('link', { name: 'Zeiterfassung' }))

    expect(await screen.findByRole('button', { name: 'Muster GmbH' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('keeps the typed name and shows an error when adding a customer fails', async () => {
    api.getCustomers.mockResolvedValue([])
    api.createCustomer.mockRejectedValue(new ApiError(500, 'boom'))
    await renderTimeTracking()

    const dialog = await openNewCustomer()
    const input = within(dialog).getByLabelText('Name')
    await userEvent.type(input, 'Muster GmbH')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Kunde konnte nicht angelegt werden.')
    expect(input).toHaveValue('Muster GmbH')
    expect(screen.getByRole('dialog', { name: 'Neuer Kunde' })).toBeInTheDocument()
  })

  test('resumes a running timer after a reload', async () => {
    api.getCustomers.mockResolvedValue([])
    api.getActiveEntry.mockResolvedValue(running)
    await renderTimeTracking()

    expect(await runningTimer()).toHaveTextContent('Website')
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop Timer' })).toBeInTheDocument()
  })

  test('after a reload, selects the customer and project of the running timer', async () => {
    api.getCustomers.mockResolvedValue([{ id: 1, name: 'Muster GmbH' }])
    api.getProjects.mockResolvedValue([{ id: 3, name: 'Andere', hourly_rate: '50.00' }, { id: 7, name: 'Website', hourly_rate: '80.00' }])
    api.getActiveEntry.mockResolvedValue(running)
    await renderTimeTracking()

    expect(await screen.findByRole('heading', { name: 'Einträge für Website' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Website/, pressed: true })).toBeInTheDocument()
    expect(api.getProjects).toHaveBeenCalledWith(1)
  })

  test('keeps focus on the timer button after stopping a resumed timer', async () => {
    api.getCustomers.mockResolvedValue([])
    api.getActiveEntry.mockResolvedValue(running)
    api.stopTimeEntry.mockResolvedValue({ ...running, end_time: new Date().toISOString() })
    await renderTimeTracking()

    await userEvent.click(await screen.findByRole('button', { name: 'Stop' }))

    expect(await screen.findByRole('button', { name: 'Start' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Timer gestoppt')
    expect(screen.queryByRole('region', { name: 'Laufender Timer' })).not.toBeInTheDocument()
  })

  test('stops the timer from the header on any page, moves focus to the page and announces it', async () => {
    api.getCustomers.mockResolvedValue([])
    api.getActiveEntry.mockResolvedValue(running)
    api.stopTimeEntry.mockResolvedValue({ ...running, end_time: new Date().toISOString() })
    render(<App />)
    await runningTimer()
    await userEvent.click(screen.getByRole('link', { name: 'Berichte' }))

    await userEvent.click(screen.getByRole('button', { name: 'Stop Timer' }))

    expect(api.stopTimeEntry).toHaveBeenCalledWith(42, expect.any(String))
    expect(screen.queryByRole('region', { name: 'Laufender Timer' })).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Timer gestoppt')
  })

  test('starts the timer for the selected project, shows it in the header and reloads the entries', async () => {
    api.getCustomers.mockResolvedValue([{ id: 1, name: 'Muster GmbH' }])
    api.createTimeEntry.mockResolvedValue({ id: 42, project_id: 7, start_time: new Date().toISOString() })
    await renderTimeTracking()
    await userEvent.click(await screen.findByRole('button', { name: 'Muster GmbH' }))
    await userEvent.click(await screen.findByRole('button', { name: /Website/, pressed: false }))

    await userEvent.click(screen.getByRole('button', { name: 'Start' }))

    expect(await runningTimer()).toHaveTextContent('Website · Muster GmbH')
    expect(screen.getByRole('status')).toHaveTextContent('Timer gestartet für Website')
    expect(screen.getByRole('button', { name: /^Muster GmbH\s*, Timer läuft$/, pressed: true })).toBeInTheDocument()
    await waitFor(() => expect(api.getCustomerTimeEntries).toHaveBeenCalledTimes(2))
  })

  test('opens the report of the selected customer from the month summary', async () => {
    api.getCustomers.mockResolvedValue([{ id: 1, name: 'Muster GmbH' }])
    api.getMonthlyReport.mockResolvedValue({ entries: [], totalHours: '0.00' })
    await renderTimeTracking()
    await userEvent.click(await screen.findByRole('button', { name: 'Muster GmbH' }))

    await userEvent.click(await screen.findByRole('link', { name: 'Bericht öffnen' }))

    expect(screen.getByRole('link', { name: 'Berichte' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText('Kunde')).toHaveValue('1')
    expect(api.getMonthlyReport).toHaveBeenCalledWith(1, new Date().getMonth() + 1, new Date().getFullYear(), false)
  })

  test('keeps the running timer when switching pages', async () => {
    api.getCustomers.mockResolvedValue([])
    api.getActiveEntry.mockResolvedValue(running)
    render(<App />)
    await runningTimer()

    await userEvent.click(screen.getByRole('link', { name: 'Berichte' }))
    expect(await runningTimer()).toHaveTextContent('Website')

    await userEvent.click(screen.getByRole('link', { name: 'Zeiterfassung' }))
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(api.getActiveEntry).toHaveBeenCalledTimes(1)
  })

  test('keeps the selected customer after adding another one', async () => {
    api.getCustomers
      .mockResolvedValueOnce([{ id: 1, name: 'Muster GmbH' }])
      .mockResolvedValueOnce([{ id: 1, name: 'Muster GmbH' }, { id: 2, name: 'Neu AG' }])
    api.createCustomer.mockResolvedValue({ id: 2, name: 'Neu AG' })
    await renderTimeTracking()

    await userEvent.click(await screen.findByRole('button', { name: 'Muster GmbH' }))
    await userEvent.click(await screen.findByRole('button', { name: /Website/, pressed: false }))
    expect(screen.getByRole('button', { name: /Website/, pressed: true })).toBeInTheDocument()

    const dialog = await openNewCustomer()
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Neu AG')
    await userEvent.type(within(dialog).getByLabelText('E-Mail (optional)'), 'info@neu.de')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }))

    expect(api.createCustomer).toHaveBeenCalledWith('Neu AG', 'info@neu.de')
    expect(await screen.findByRole('button', { name: 'Neu AG', pressed: false })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Neuer Kunde' })).toHaveFocus()
    expect(screen.getByRole('button', { name: /Website/, pressed: true })).toBeInTheDocument()
  })

  test('has no detectable accessibility violations on the Dashboard with a running timer', async () => {
    api.getCustomers.mockResolvedValue([])
    api.getActiveEntry.mockResolvedValue(running)
    render(<App />)
    await runningTimer()
    await screen.findByRole('heading', { name: 'Zeit erfassen' })

    expect(await axe(document.body)).toHaveNoViolations()
  })

  test('switches to English without a reload and keeps the running timer and typed text', async () => {
    api.getCustomers.mockResolvedValue([{ id: 1, name: 'Muster GmbH' }])
    api.getActiveEntry.mockResolvedValue(running)
    await renderTimeTracking()
    await runningTimer()
    // typed into an inline edit form: while a modal dialog is open, the page behind it can't be used
    await userEvent.click(await screen.findByRole('button', { name: 'Muster GmbH bearbeiten' }))
    const name = screen.getByLabelText('Name')
    await userEvent.type(name, ' AG')

    await userEvent.click(screen.getByRole('button', { name: 'English' }))

    expect(await runningTimer('Running timer')).toHaveTextContent('Website')
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Edit customer' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Muster GmbH AG')
    expect(screen.getByRole('link', { name: 'Reports' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
    expect(api.getActiveEntry).toHaveBeenCalledTimes(1)
    expect(api.getCustomers).toHaveBeenCalledTimes(1)
  })

  test('starts on the Dashboard and names the pages in both languages', async () => {
    api.getCustomers.mockResolvedValue([])
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('navigation').textContent).toBe('DashboardZeiterfassungEinträgeBerichte')
    expect(api.getDashboard).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('link', { name: 'Zeiterfassung' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Zeiterfassung' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Time tracking' })).toBeInTheDocument()
    expect(screen.getByRole('navigation').textContent).toBe('DashboardTime trackingEntriesReports')
  })

  test('the Entries page searches all customers and opens a result on the Time tracking page', async () => {
    api.getCustomers.mockResolvedValue([{ id: 1, name: 'Muster GmbH' }])
    api.getProjects.mockResolvedValue([{ id: 7, name: 'Website', hourly_rate: '80.00' }])
    api.searchTimeEntries.mockResolvedValue({
      entries: [{ id: 5, customer_id: 1, customer_name: 'Muster GmbH', project_id: 7, project_name: 'Website', description: 'Konzept',
        start_time: '2026-09-21T08:00:00Z', end_time: '2026-09-21T09:00:00Z' }],
      total: 1, hours: 1, limit: 50, offset: 0,
    })
    render(<App />)

    await userEvent.click(await screen.findByRole('link', { name: 'Einträge' }))
    expect(screen.getByRole('link', { name: 'Einträge' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { level: 1, name: 'Einträge' })).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('link', { name: /^Öffnen\s+in Zeiterfassung/ }))

    expect(screen.getByRole('link', { name: 'Zeiterfassung' })).toHaveAttribute('aria-current', 'page')
    expect(await screen.findByRole('heading', { name: 'Einträge für Website' })).toBeInTheDocument()
  })

  test('selecting a recent entry on the Dashboard opens its customer and project on the Time tracking page', async () => {
    api.getCustomers.mockResolvedValue([{ id: 1, name: 'Muster GmbH' }])
    api.getProjects.mockResolvedValue([{ id: 3, name: 'App', hourly_rate: '50.00' }, { id: 7, name: 'Website', hourly_rate: '80.00' }])
    api.getDashboard.mockResolvedValue({
      ...emptyDashboard,
      recent: [{ id: 5, customer_id: 1, customer_name: 'Muster GmbH', project_id: 7, project_name: 'Website', description: 'Konzept',
        start_time: '2026-09-21T08:00:00Z', end_time: '2026-09-21T09:00:00Z' }],
    })
    render(<App />)

    await userEvent.click(await screen.findByRole('link', { name: /Konzept/ }))

    expect(screen.getByRole('link', { name: 'Zeiterfassung' })).toHaveAttribute('aria-current', 'page')
    expect(await screen.findByRole('heading', { name: 'Einträge für Website' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Muster GmbH', pressed: true })).toBeInTheDocument()
  })

  test('opens last month\'s report of a customer from the Dashboard', async () => {
    api.getCustomers.mockResolvedValue([{ id: 1, name: 'Muster GmbH' }])
    api.getMonthlyReport.mockResolvedValue({ entries: [], totalHours: '0.00', status: 'draft' })
    api.getDashboard.mockResolvedValue({
      ...emptyDashboard,
      lastMonthReports: { month: 8, year: 2026, reports: [{ customer_id: 1, customer_name: 'Muster GmbH', status: 'ready' }] },
    })
    render(<App />)

    await userEvent.click(await screen.findByRole('link', { name: 'Abrechnung für Muster GmbH öffnen' }))

    expect(screen.getByRole('link', { name: 'Berichte' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText('Kunde')).toHaveValue('1')
    expect(api.getMonthlyReport).toHaveBeenCalledWith(1, 8, 2026, false)
  })

  test('an error that is already shown follows the language switch', async () => {
    api.getCustomers.mockRejectedValue(new ApiError(0, 'unreachable'))
    render(<App />)
    await screen.findByRole('alert')

    await userEvent.click(screen.getByRole('button', { name: 'English' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Customers could not be loaded. The server is not reachable.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  test('starts in the stored language', async () => {
    window.localStorage.setItem('language', 'en')
    const { detectLocale, activateLocale } = await import('@/i18n')
    activateLocale(detectLocale())
    api.getCustomers.mockResolvedValue([])
    await renderTimeTracking()

    expect(await screen.findByRole('heading', { name: 'Customers' })).toBeInTheDocument()
  })

  test('adds time manually, for the first project when none is selected, and shows it in the list', async () => {
    const added = { id: 9, project_id: 7, start_time: fromInputs('2026-09-21', '08:00'), end_time: fromInputs('2026-09-21', '09:30'), description: 'Nachgetragen' }
    api.getCustomers.mockResolvedValue([{ id: 1, name: 'Muster GmbH' }])
    api.getCustomerTimeEntries.mockResolvedValueOnce([]).mockResolvedValueOnce([added])
    api.createTimeEntry.mockResolvedValue(added)
    await renderTimeTracking()
    await userEvent.click(await screen.findByRole('button', { name: 'Muster GmbH' }))

    await userEvent.click(await screen.findByRole('button', { name: 'Zeit nachtragen' }))
    const form = screen.getByRole('dialog', { name: 'Zeit nachtragen' })
    await userEvent.clear(within(form).getByLabelText('Datum'))
    await userEvent.type(within(form).getByLabelText('Datum'), '2026-09-21')
    await userEvent.type(within(form).getByLabelText('Start'), '08:00')
    await userEvent.type(within(form).getByLabelText('Ende'), '09:30')
    await userEvent.type(within(form).getByLabelText('Beschreibung (optional)'), 'Nachgetragen')
    expect(within(form).getByLabelText('Projekt')).toHaveValue('7')
    await userEvent.click(within(form).getByRole('button', { name: 'Speichern' }))

    expect(api.createTimeEntry).toHaveBeenCalledWith(7, fromInputs('2026-09-21', '08:00'), 'Nachgetragen', fromInputs('2026-09-21', '09:30'))
    expect(await screen.findByText('Nachgetragen')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zeit nachtragen' })).toHaveFocus()
  })

  test('renaming the selected customer keeps it and its project selected', async () => {
    api.getCustomers
      .mockResolvedValueOnce([{ id: 1, name: 'Muster GmbH' }])
      .mockResolvedValueOnce([{ id: 1, name: 'Muster AG' }])
    api.updateCustomer.mockResolvedValue({ id: 1, name: 'Muster AG' })
    await renderTimeTracking()
    await userEvent.click(await screen.findByRole('button', { name: 'Muster GmbH' }))
    await userEvent.click(await screen.findByRole('button', { name: /Website/, pressed: false }))
    await screen.findByRole('heading', { name: 'Einträge für Website' })

    await userEvent.click(screen.getByRole('button', { name: 'Muster GmbH bearbeiten' }))
    const name = screen.getByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Muster AG')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(api.updateCustomer).toHaveBeenCalledWith(1, 'Muster AG', '')
    expect(await screen.findByRole('button', { name: 'Muster AG', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Einträge für Website' })).toBeInTheDocument()
    expect(api.getProjects).toHaveBeenCalledTimes(1)
  })

  test('deleting the selected customer clears its projects', async () => {
    api.getCustomers
      .mockResolvedValueOnce([{ id: 1, name: 'Muster GmbH' }])
      .mockResolvedValueOnce([])
    api.deleteCustomer.mockResolvedValue({ id: 1 })
    await renderTimeTracking()
    await userEvent.click(await screen.findByRole('button', { name: 'Muster GmbH' }))
    await screen.findByRole('heading', { name: 'Einträge für Muster GmbH' })

    await userEvent.click(screen.getByRole('button', { name: 'Muster GmbH löschen' }))
    expect(screen.getByRole('group', { name: 'Muster GmbH und alle Projekte und Zeiteinträge löschen?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }))

    expect(api.deleteCustomer).toHaveBeenCalledWith(1)
    expect(await screen.findByText('Wähle einen Kunden')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Einträge für/ })).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Kunden' })).toHaveFocus()
  })

  test('selecting a customer shows all its entries grouped by project, and a project narrows them', async () => {
    api.getCustomers.mockResolvedValue([{ id: 1, name: 'Muster GmbH' }])
    api.getProjects.mockResolvedValue([{ id: 3, name: 'App', hourly_rate: '50.00' }, { id: 7, name: 'Website', hourly_rate: '80.00' }])
    api.getCustomerTimeEntries.mockResolvedValue([
      { id: 1, project_id: 3, start_time: '2026-09-21T08:00:00Z', end_time: '2026-09-21T09:00:00Z', description: 'App-Arbeit' },
      { id: 2, project_id: 7, start_time: '2026-09-21T10:00:00Z', end_time: '2026-09-21T12:00:00Z', description: 'Website-Arbeit' },
    ])
    await renderTimeTracking()

    await userEvent.click(await screen.findByRole('button', { name: 'Muster GmbH' }))

    expect(await screen.findByRole('heading', { name: 'Einträge für Muster GmbH' })).toBeInTheDocument()
    expect(api.getCustomerTimeEntries).toHaveBeenCalledWith(1)
    expect(screen.getByRole('button', { name: /Website/, pressed: false })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /App/, pressed: false })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /^App/ })).toHaveTextContent('App-Arbeit')
    expect(screen.getByRole('table', { name: /^Website/ })).toHaveTextContent('Website-Arbeit')
    expect(screen.getByText('Wähle ein Projekt, um den Timer zu starten.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Website/, pressed: false }))
    expect(screen.getByRole('heading', { name: 'Einträge für Website' })).toBeInTheDocument()
    expect(screen.queryByText('App-Arbeit')).not.toBeInTheDocument()
    expect(screen.getByText('Website-Arbeit')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Website/, pressed: true }))
    expect(screen.getByRole('heading', { name: 'Einträge für Muster GmbH' })).toBeInTheDocument()
    expect(screen.getByText('App-Arbeit')).toBeInTheDocument()
    expect(api.getCustomerTimeEntries).toHaveBeenCalledTimes(1)
  })

  test('ignores late answers for a customer that is no longer selected', async () => {
    api.getCustomers.mockResolvedValue([{ id: 1, name: 'Muster GmbH' }, { id: 2, name: 'Berger' }])
    const late = {}
    api.getProjects.mockImplementation((id) => (id === 1
      ? new Promise((resolve) => { late.projects = resolve })
      : Promise.resolve([{ id: 9, name: 'Pflege', hourly_rate: '85.00' }])))
    api.getCustomerTimeEntries.mockImplementation((id) => (id === 1
      ? new Promise((resolve) => { late.entries = resolve })
      : Promise.resolve([{ id: 3, project_id: 9, start_time: '2026-09-22T13:00:00Z', end_time: '2026-09-22T14:00:00Z', description: 'Berger-Arbeit' }])))
    await renderTimeTracking()

    await userEvent.click(await screen.findByRole('button', { name: 'Muster GmbH' }))
    await userEvent.click(screen.getByRole('button', { name: 'Berger' }))
    await screen.findByText('Berger-Arbeit')
    await act(async () => {
      late.projects([{ id: 7, name: 'Website', hourly_rate: '80.00' }])
      late.entries([{ id: 2, project_id: 7, start_time: '2026-09-21T10:00:00Z', end_time: '2026-09-21T12:00:00Z', description: 'Muster-Arbeit' }])
    })

    expect(screen.getByRole('heading', { name: 'Berger' })).toBeInTheDocument()
    expect(screen.getByText('Berger-Arbeit')).toBeInTheDocument()
    expect(screen.queryByText('Muster-Arbeit')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Website/ })).not.toBeInTheDocument()
  })

  test('deleting a project reloads the entries of the customer', async () => {
    api.getCustomers.mockResolvedValue([{ id: 1, name: 'Muster GmbH' }])
    api.getProjects
      .mockResolvedValueOnce([{ id: 7, name: 'Website', hourly_rate: '80.00' }])
      .mockResolvedValueOnce([])
    api.getCustomerTimeEntries
      .mockResolvedValueOnce([{ id: 2, project_id: 7, start_time: '2026-09-21T10:00:00Z', end_time: '2026-09-21T12:00:00Z', description: 'Website-Arbeit' }])
      .mockResolvedValueOnce([])
    api.deleteProject.mockResolvedValue({ id: 7 })
    await renderTimeTracking()
    await userEvent.click(await screen.findByRole('button', { name: 'Muster GmbH' }))
    await screen.findByText('Website-Arbeit')
    expect(screen.queryByRole('button', { name: 'Website löschen' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Website/, pressed: false }))

    await userEvent.click(screen.getByRole('button', { name: 'Website löschen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }))

    expect(await screen.findByText('Noch keine Einträge')).toBeInTheDocument()
    expect(api.getCustomerTimeEntries).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('group', { name: 'Projekte' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Zeit nachtragen' })).not.toBeInTheDocument()
  })

  test('adds a project in a dialog and keeps the selected project', async () => {
    api.getCustomers.mockResolvedValue([{ id: 1, name: 'Muster GmbH' }])
    api.getProjects
      .mockResolvedValueOnce([{ id: 7, name: 'Website', hourly_rate: '80.00' }])
      .mockResolvedValueOnce([{ id: 7, name: 'Website', hourly_rate: '80.00' }, { id: 8, name: 'App', hourly_rate: '95.00' }])
    api.createProject = vi.fn().mockResolvedValue({ id: 8 })
    await renderTimeTracking()
    await userEvent.click(await screen.findByRole('button', { name: 'Muster GmbH' }))
    await userEvent.click(await screen.findByRole('button', { name: /Website/, pressed: false }))

    await userEvent.click(await screen.findByRole('button', { name: 'Neues Projekt' }))
    const dialog = screen.getByRole('dialog', { name: 'Neues Projekt' })
    await userEvent.type(within(dialog).getByLabelText('Name'), 'App')
    await userEvent.type(within(dialog).getByLabelText('Stundensatz (€)'), '95')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }))

    expect(api.createProject).toHaveBeenCalledWith(1, 'App', 95)
    expect(await screen.findByRole('button', { name: /App/, pressed: false })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Website/, pressed: true })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('cancelling a dialog discards the input', async () => {
    api.getCustomers.mockResolvedValue([])
    await renderTimeTracking()

    let dialog = await openNewCustomer()
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Verworfen')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.createCustomer).not.toHaveBeenCalled()

    dialog = await openNewCustomer()
    expect(within(dialog).getByLabelText('Name')).toHaveValue('')
  })

  test('has no detectable accessibility violations with a dialog open', async () => {
    api.getCustomers.mockResolvedValue([])
    const { container } = await renderTimeTracking()
    await openNewCustomer()

    expect(await axe(container)).toHaveNoViolations()
  })
})

// Shows where the router is and moves it like the browser's back and forward buttons
function Location() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <div>
      <p data-testid="path">{location.pathname}</p>
      <button onClick={() => navigate(-1)}>history back</button>
      <button onClick={() => navigate(1)}>history forward</button>
    </div>
  )
}

const renderAt = (route) => render(<><App /><Location /></>, { route })
const path = () => screen.getByTestId('path').textContent

describe('App addresses', () => {
  beforeEach(() => {
    api.getCustomers.mockResolvedValue([{ id: 1, name: 'Muster GmbH' }])
    api.getMonthlyReport.mockResolvedValue({ entries: [], totalHours: '0.00', status: 'draft' })
  })

  test('the navigation items are links to the pages, and the current one is marked', async () => {
    renderAt('/')

    const nav = within(await screen.findByRole('navigation', { name: 'Hauptnavigation' }))
    expect(nav.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(
      ['/', '/time-tracking', '/entries', '/reports']
    )
    expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(nav.getByRole('link', { name: 'Berichte' })).not.toHaveAttribute('aria-current')
  })

  test('a deep link opens that page, with or without a trailing slash', async () => {
    const first = renderAt('/reports')
    expect(await screen.findByRole('heading', { level: 1, name: 'Berichte' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Berichte' })).toHaveAttribute('aria-current', 'page')
    first.unmount()

    renderAt('/entries/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Einträge' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Einträge' })).toHaveAttribute('aria-current', 'page')
  })

  test('back and forward move between the visited pages', async () => {
    renderAt('/')
    await userEvent.click(await screen.findByRole('link', { name: 'Berichte' }))
    await waitFor(() => expect(path()).toBe('/reports'))
    await userEvent.click(screen.getByRole('link', { name: 'Zeiterfassung' }))
    await waitFor(() => expect(path()).toBe('/time-tracking'))

    await userEvent.click(screen.getByRole('button', { name: 'history back' }))
    await waitFor(() => expect(path()).toBe('/reports'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Berichte' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'history forward' }))
    await waitFor(() => expect(screen.getByRole('link', { name: 'Zeiterfassung' })).toHaveAttribute('aria-current', 'page'))
  })

  test('an unknown address shows the not-found page with a link home, and marks no page as current', async () => {
    renderAt('/gibt-es-nicht')

    expect(await screen.findByRole('heading', { level: 1, name: 'Seite nicht gefunden' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation')).queryByRole('link', { current: 'page' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Zum Dashboard' }))

    await waitFor(() => expect(path()).toBe('/'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  })

  test('has no detectable accessibility violations on the not-found page', async () => {
    const { container } = renderAt('/nope')
    await screen.findByRole('heading', { level: 1, name: 'Seite nicht gefunden' })

    expect(await axe(container)).toHaveNoViolations()
  })

  test('the page title names the page in both languages and follows a language switch', async () => {
    renderAt('/')
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    await waitFor(() => expect(document.title).toBe('Dashboard · Time Tracking'))

    await userEvent.click(screen.getByRole('link', { name: 'Berichte' }))
    await waitFor(() => expect(document.title).toBe('Berichte · Time Tracking'))

    await userEvent.click(screen.getByRole('button', { name: 'English' }))
    await waitFor(() => expect(document.title).toBe('Reports · Time Tracking'))

    await userEvent.click(screen.getByRole('link', { name: 'Time tracking' }))
    await waitFor(() => expect(document.title).toBe('Time tracking · Time Tracking'))
  })

  test('the not-found page has its own title', async () => {
    renderAt('/nope')
    await screen.findByRole('heading', { level: 1, name: 'Seite nicht gefunden' })
    await waitFor(() => expect(document.title).toBe('Seite nicht gefunden · Time Tracking'))

    await userEvent.click(screen.getByRole('button', { name: 'English' }))
    await waitFor(() => expect(document.title).toBe('Page not found · Time Tracking'))
  })

  test('moves focus to the new page\'s heading, but not on the first render', async () => {
    renderAt('/')
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    await act(async () => {}) // let the effects of the first render run: nothing may take the focus
    expect(document.body).toHaveFocus()

    await userEvent.click(screen.getByRole('link', { name: 'Einträge' }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Einträge' })).toHaveFocus())

    // Reports has a visually hidden heading
    await userEvent.click(screen.getByRole('link', { name: 'Berichte' }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Berichte' })).toHaveFocus())
  })

  test('on the Time tracking page without a customer, the visually hidden heading takes the focus', async () => {
    renderAt('/')
    await userEvent.click(await screen.findByRole('link', { name: 'Zeiterfassung' }))

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Zeiterfassung' })).toHaveFocus())
  })

  test('focus goes to the new page when a page is opened from the Dashboard', async () => {
    api.getDashboard.mockResolvedValue({
      ...emptyDashboard,
      lastMonthReports: { month: 8, year: 2026, reports: [{ customer_id: 1, customer_name: 'Muster GmbH', status: 'ready' }] },
    })
    renderAt('/')
    await userEvent.click(await screen.findByRole('link', { name: 'Abrechnung für Muster GmbH öffnen' }))

    await waitFor(() => expect(path()).toBe('/reports/1/2026-08'))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Berichte' })).toHaveFocus())
  })

  test('does not move focus when the same page stays open', async () => {
    renderAt('/reports')
    await screen.findByRole('heading', { level: 1, name: 'Berichte' })
    const link = screen.getByRole('link', { name: 'Berichte' })
    await userEvent.click(link)
    await act(async () => {}) // let the effects of the navigation run: the focus must stay on the link

    expect(link).toHaveFocus()
  })

  test('after a login the focus goes to the page content, not to the heading', async () => {
    render(<App focusOnStart />, { route: '/reports' })
    await screen.findByRole('heading', { level: 1, name: 'Berichte' })

    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus())
  })

  test('the running timer stays when the page changes', async () => {
    api.getActiveEntry.mockResolvedValue(running)
    renderAt('/')
    const region = await runningTimer()

    await userEvent.click(screen.getByRole('link', { name: 'Berichte' }))
    await userEvent.click(screen.getByRole('link', { name: 'Einträge' }))

    expect(await runningTimer()).toBe(region)
    expect(api.getActiveEntry).toHaveBeenCalledTimes(1)
    expect(api.getCustomers).toHaveBeenCalledTimes(1)
  })

  test('opening the report from the Time tracking page changes the address', async () => {
    renderAt('/time-tracking')
    await userEvent.click(await screen.findByRole('button', { name: 'Muster GmbH' }))
    await userEvent.click(await screen.findByRole('link', { name: 'Bericht öffnen' }))

    await waitFor(() => expect(path()).toBe('/reports/1'))
    expect(screen.getByLabelText('Kunde')).toHaveValue('1')
  })

  test.each(['/reports/1/foo', '/reports/1/2026-13', '/time-tracking/1/2/3', '/entries/1', '/api/customers'])(
    '%s shows the not-found page', async (route) => {
      renderAt(route)

      expect(await screen.findByRole('heading', { level: 1, name: 'Seite nicht gefunden' })).toBeInTheDocument()
    })

  test.each(['/reports/1/foo', '/time-tracking/1/2/3'])('%s marks no page as current while the not-found page is shown', async (route) => {
    renderAt(route)
    await screen.findByRole('heading', { level: 1, name: 'Seite nicht gefunden' })

    expect(within(screen.getByRole('navigation')).queryByRole('link', { current: 'page' })).not.toBeInTheDocument()
  })

  test.each([['/time-tracking/1', 'Zeiterfassung'], ['/time-tracking/1/7', 'Zeiterfassung'], ['/reports/1', 'Berichte'], ['/reports/1/2026-09', 'Berichte']])(
    'the link of the page stays current on %s', async (route, name) => {
      api.getCustomers.mockResolvedValue([{ id: 1, name: 'Muster GmbH' }])
      api.getProjects.mockResolvedValue([{ id: 7, name: 'Website', hourly_rate: '80.00' }])
      renderAt(route)

      expect(await screen.findByRole('link', { name })).toHaveAttribute('aria-current', 'page')
    })

  test('a trailing slash keeps the page and its link current', async () => {
    renderAt('/time-tracking/')

    expect(await screen.findByRole('link', { name: 'Zeiterfassung' })).toHaveAttribute('aria-current', 'page')
  })

  test('moves focus to the heading of the page that back returns to', async () => {
    renderAt('/')
    await userEvent.click(await screen.findByRole('link', { name: 'Berichte' }))
    await userEvent.click(screen.getByRole('link', { name: 'Einträge' }))

    await userEvent.click(screen.getByRole('button', { name: 'history back' }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Berichte' })).toHaveFocus())
  })

  test('navigating makes no new calls for the customers or the timer', async () => {
    renderAt('/')
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })

    await userEvent.click(screen.getByRole('link', { name: 'Einträge' }))
    await userEvent.click(screen.getByRole('link', { name: 'Zeiterfassung' }))

    expect(api.getCustomers).toHaveBeenCalledTimes(1)
    expect(api.getActiveEntry).toHaveBeenCalledTimes(1)
  })
})

describe('App selections in the address', () => {
  // A project chip (the edit and delete buttons of the selected project are outside of the group)
  const chip = (name) => within(screen.getByRole('group', { name: 'Projekte' })).getByRole('button', { name })

  beforeEach(() => {
    api.getCustomers.mockResolvedValue([{ id: 1, name: 'Muster GmbH' }, { id: 2, name: 'Neu AG' }])
    api.getProjects.mockResolvedValue([{ id: 7, name: 'Website', hourly_rate: '80.00' }, { id: 8, name: 'Wartung', hourly_rate: '60.00' }])
  })

  test('choosing a customer and a project puts them into the address, and choosing the project again removes it', async () => {
    renderAt('/time-tracking')

    await userEvent.click(await screen.findByRole('button', { name: 'Muster GmbH' }))
    expect(path()).toBe('/time-tracking/1')
    await waitFor(() => expect(chip(/Website/)).toBeInTheDocument())
    await userEvent.click(chip(/Website/))
    expect(path()).toBe('/time-tracking/1/7')
    expect(chip(/Website/)).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(chip(/Website/))
    expect(path()).toBe('/time-tracking/1')
    await userEvent.click(chip(/Website/))
    await userEvent.click(chip('Alle Projekte'))
    expect(path()).toBe('/time-tracking/1')
    expect(chip('Alle Projekte')).toHaveAttribute('aria-pressed', 'true')
  })

  test('an address with a customer and a project opens them, also after a reload', async () => {
    renderAt('/time-tracking/1/8')

    expect(await screen.findByRole('heading', { level: 1, name: 'Muster GmbH' })).toBeInTheDocument()
    await screen.findByRole('group', { name: 'Projekte' })
    await waitFor(() => expect(chip(/Wartung/)).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByRole('heading', { name: 'Einträge für Wartung' })).toBeInTheDocument()
    expect(api.getProjects).toHaveBeenCalledWith(1)
    expect(screen.getByRole('link', { name: 'Zeiterfassung' })).toHaveAttribute('aria-current', 'page')
  })

  test('Back returns to the customer that was open before', async () => {
    renderAt('/time-tracking/1')
    await screen.findByRole('heading', { level: 1, name: 'Muster GmbH' })

    await userEvent.click(screen.getByRole('button', { name: 'Neu AG' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Neu AG' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'history back' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Muster GmbH' })).toBeInTheDocument()
    expect(path()).toBe('/time-tracking/1')
  })

  test('does not move the focus when only the selection changes', async () => {
    renderAt('/time-tracking/1')
    await screen.findByRole('heading', { level: 1, name: 'Muster GmbH' })
    const button = screen.getByRole('button', { name: 'Neu AG' })

    await userEvent.click(button)
    await screen.findByRole('heading', { level: 1, name: 'Neu AG' })
    await act(async () => {})

    expect(button).toHaveFocus()
  })

  test('opens the project of the running timer with a customer that has one', async () => {
    api.getActiveEntry.mockResolvedValue(running)
    renderAt('/time-tracking')
    await runningTimer()

    await waitFor(() => expect(path()).toBe('/time-tracking/1/7'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Muster GmbH' })).toBeInTheDocument()
  })

  test('replaces the address of the running timer, so Back leaves the page', async () => {
    api.getActiveEntry.mockResolvedValue(running)
    renderAt('/')
    await userEvent.click(await screen.findByRole('link', { name: 'Zeiterfassung' }))
    await waitFor(() => expect(path()).toBe('/time-tracking/1/7'))

    await userEvent.click(screen.getByRole('button', { name: 'history back' }))

    expect(path()).toBe('/')
  })

  test('selects the running timer\'s project when its customer is chosen', async () => {
    api.getActiveEntry.mockResolvedValue({ ...running, customer_id: 2, customer_name: 'Neu AG' })
    renderAt('/time-tracking/1')
    await screen.findByRole('heading', { level: 1, name: 'Muster GmbH' })

    await userEvent.click(screen.getByRole('button', { name: /^Neu AG\s*, Timer läuft$/ }))

    expect(path()).toBe('/time-tracking/2/7')
  })

  test('clicking the open customer or the selected "All projects" adds no history entry', async () => {
    renderAt(['/', '/time-tracking/1'])
    await screen.findByRole('heading', { level: 1, name: 'Muster GmbH' })

    await userEvent.click(screen.getByRole('button', { name: 'Muster GmbH' }))
    await userEvent.click(chip('Alle Projekte'))
    await userEvent.click(screen.getByRole('button', { name: 'history back' }))

    expect(path()).toBe('/')
  })

  test('following the link of a message moves focus to the heading', async () => {
    renderAt('/time-tracking/1/99')
    await userEvent.click(await screen.findByRole('link', { name: 'Alle Projekte anzeigen' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Muster GmbH' })).toHaveFocus()
  })

  test('says so for a customer that does not exist, and links back', async () => {
    renderAt('/time-tracking/99')

    expect(await screen.findByRole('alert')).toHaveTextContent('Dieser Kunde existiert nicht (mehr).')
    expect(screen.getByText('Wähle einen Kunden')).toBeInTheDocument()
    expect(api.getProjects).not.toHaveBeenCalled()
    expect(api.getCustomerTimeEntries).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('link', { name: 'Zurück zu Zeiterfassung' }))
    expect(path()).toBe('/time-tracking')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test.each(['abc', '0', '1x'])('treats the customer %s in the address as one that does not exist', async (id) => {
    renderAt(`/time-tracking/${id}`)

    expect(await screen.findByRole('alert')).toHaveTextContent('Dieser Kunde existiert nicht (mehr).')
  })

  test('says so for a project that does not exist, only after the projects are loaded, and keeps the customer', async () => {
    let resolveProjects
    api.getProjects.mockReturnValue(new Promise((resolve) => { resolveProjects = resolve }))
    renderAt('/time-tracking/1/99')
    await screen.findByRole('heading', { level: 1, name: 'Muster GmbH' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await act(async () => resolveProjects([{ id: 7, name: 'Website', hourly_rate: '80.00' }]))

    expect(await screen.findByRole('alert')).toHaveTextContent('Dieses Projekt existiert nicht (mehr).')
    expect(screen.getByRole('heading', { name: 'Einträge für Muster GmbH' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Alle Projekte anzeigen' }))
    expect(path()).toBe('/time-tracking/1')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('a project of another customer does not exist for this one', async () => {
    api.getProjects.mockImplementation(async (customerId) => (customerId === 1 ? [{ id: 7, name: 'Website', hourly_rate: '80.00' }] : []))
    renderAt('/time-tracking/2/7')

    expect(await screen.findByRole('alert')).toHaveTextContent('Dieses Projekt existiert nicht (mehr).')
  })

  test('deleting the selected customer replaces the address with the page without one', async () => {
    api.getCustomers.mockResolvedValueOnce([{ id: 1, name: 'Muster GmbH' }]).mockResolvedValueOnce([])
    api.deleteCustomer.mockResolvedValue({ id: 1 })
    renderAt('/time-tracking/1')
    await userEvent.click(await screen.findByRole('button', { name: 'Muster GmbH löschen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }))

    await waitFor(() => expect(path()).toBe('/time-tracking'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'history back' }))
    expect(path()).not.toBe('/time-tracking/1')
  })

  test('deleting the selected project goes back to its customer without a message', async () => {
    api.getProjects
      .mockResolvedValueOnce([{ id: 7, name: 'Website', hourly_rate: '80.00' }])
      .mockResolvedValueOnce([])
    api.deleteProject.mockResolvedValue({ id: 7 })
    renderAt('/time-tracking/1/7')
    await userEvent.click(await screen.findByRole('button', { name: 'Website löschen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }))

    await waitFor(() => expect(path()).toBe('/time-tracking/1'))
    await screen.findByText('Noch keine Einträge')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('the month summary links to the report of the customer', async () => {
    renderAt('/time-tracking/2/8')

    expect(await screen.findByRole('link', { name: 'Bericht öffnen' })).toHaveAttribute('href', '/reports/2')
  })

  test('opens the selection for an address in capital letters and with a trailing slash', async () => {
    renderAt('/Time-Tracking/1/7/')

    expect(await screen.findByRole('heading', { level: 1, name: 'Muster GmbH' })).toBeInTheDocument()
    await waitFor(() => expect(chip(/Website/)).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test.each(['1e3', '99999999999999999999', '-1', '01'])('treats the customer %s in the address as one that does not exist', async (id) => {
    renderAt(`/time-tracking/${id}`)

    expect(await screen.findByRole('alert')).toHaveTextContent('Dieser Kunde existiert nicht (mehr).')
    expect(api.getProjects).not.toHaveBeenCalled()
  })

  test.each(['abc', '1e3', '0'])('says so at once for the project %s, which cannot be an id, and keeps the customer', async (id) => {
    renderAt(`/time-tracking/1/${id}`)

    expect(await screen.findByRole('alert')).toHaveTextContent('Dieses Projekt existiert nicht (mehr).')
    expect(screen.getByRole('heading', { level: 1, name: 'Muster GmbH' })).toBeInTheDocument()
  })

  test('shows no message for a project while the projects load, and none once it is among them', async () => {
    let resolveProjects
    api.getProjects.mockReturnValue(new Promise((resolve) => { resolveProjects = resolve }))
    renderAt('/time-tracking/1/8')
    await screen.findByRole('heading', { level: 1, name: 'Muster GmbH' })

    await act(async () => resolveProjects([{ id: 8, name: 'Wartung', hourly_rate: '60.00' }]))

    await waitFor(() => expect(chip(/Wartung/)).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('drops the projects and entries that arrive late for the customer chosen before', async () => {
    let resolveFirst
    api.getProjects.mockImplementation((customerId) => (
      customerId === 1
        ? new Promise((resolve) => { resolveFirst = resolve })
        : Promise.resolve([{ id: 9, name: 'Pflege', hourly_rate: '50.00' }])
    ))
    renderAt('/time-tracking/1')
    await screen.findByRole('heading', { level: 1, name: 'Muster GmbH' })

    await userEvent.click(screen.getByRole('button', { name: 'Neu AG' }))
    await waitFor(() => expect(chip(/Pflege/)).toBeInTheDocument())
    await act(async () => resolveFirst([{ id: 7, name: 'Website', hourly_rate: '80.00' }]))

    expect(screen.queryByRole('button', { name: /Website/ })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Neu AG' })).toBeInTheDocument()
  })

  test('opens the running timer only once: choosing no project afterwards stays on the customer', async () => {
    api.getActiveEntry.mockResolvedValue(running)
    renderAt('/time-tracking')
    await waitFor(() => expect(path()).toBe('/time-tracking/1/7'))
    await waitFor(() => expect(chip(/Website/)).toBeInTheDocument())

    await userEvent.click(chip('Alle Projekte'))
    await act(async () => {})

    expect(path()).toBe('/time-tracking/1')
  })

  test('leaves an address with a customer alone while a timer runs for another one', async () => {
    api.getActiveEntry.mockResolvedValue({ ...running, customer_id: 2, customer_name: 'Neu AG' })
    renderAt('/time-tracking/1')
    await runningTimer()
    await screen.findByRole('heading', { level: 1, name: 'Muster GmbH' })
    await act(async () => {})

    expect(path()).toBe('/time-tracking/1')
  })

  test('does not open the customer of a running timer that is not in the list', async () => {
    api.getActiveEntry.mockResolvedValue({ ...running, customer_id: 99 })
    renderAt('/time-tracking')
    await runningTimer()
    await act(async () => {})

    expect(path()).toBe('/time-tracking')
    expect(screen.getByText('Wähle einen Kunden')).toBeInTheDocument()
  })

  test('the link back from a missing customer stays on the page, even with a timer running', async () => {
    api.getActiveEntry.mockResolvedValue(running)
    renderAt('/time-tracking/99')
    await runningTimer()

    await userEvent.click(await screen.findByRole('link', { name: 'Zurück zu Zeiterfassung' }))
    await act(async () => {})

    expect(path()).toBe('/time-tracking')
    expect(screen.getByText('Wähle einen Kunden')).toBeInTheDocument()
  })

  test('has no accessibility violations for a missing customer and a missing project', async () => {
    const first = renderAt('/time-tracking/99')
    await screen.findByRole('alert')
    expect(await axe(first.container)).toHaveNoViolations()
    first.unmount()

    const second = renderAt('/time-tracking/1/99')
    await screen.findByRole('alert')
    expect(await axe(second.container)).toHaveNoViolations()
  })
})
