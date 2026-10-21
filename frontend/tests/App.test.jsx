import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, render, screen, waitFor, within } from './support/render'
import userEvent from '@testing-library/user-event'
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
  await userEvent.click(await screen.findByRole('button', { name: /^(Zeiterfassung|Time tracking)$/ }))
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
    await userEvent.click(screen.getByRole('button', { name: 'Zeiterfassung' }))

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
    await userEvent.click(screen.getByRole('button', { name: 'Berichte' }))

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

    await userEvent.click(await screen.findByRole('button', { name: 'Bericht öffnen' }))

    expect(screen.getByRole('button', { name: 'Berichte' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText('Kunde')).toHaveValue('1')
    expect(api.getMonthlyReport).toHaveBeenCalledWith(1, new Date().getMonth() + 1, new Date().getFullYear())
  })

  test('keeps the running timer when switching pages', async () => {
    api.getCustomers.mockResolvedValue([])
    api.getActiveEntry.mockResolvedValue(running)
    render(<App />)
    await runningTimer()

    await userEvent.click(screen.getByRole('button', { name: 'Berichte' }))
    expect(await runningTimer()).toHaveTextContent('Website')

    await userEvent.click(screen.getByRole('button', { name: 'Zeiterfassung' }))
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
    expect(screen.getByRole('button', { name: 'Reports' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
    expect(api.getActiveEntry).toHaveBeenCalledTimes(1)
    expect(api.getCustomers).toHaveBeenCalledTimes(1)
  })

  test('starts on the Dashboard and names the pages in both languages', async () => {
    api.getCustomers.mockResolvedValue([])
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('navigation').textContent).toBe('DashboardZeiterfassungEinträgeBerichte')
    expect(api.getDashboard).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'Zeiterfassung' }))
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

    await userEvent.click(await screen.findByRole('button', { name: 'Einträge' }))
    expect(screen.getByRole('button', { name: 'Einträge' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { level: 1, name: 'Einträge' })).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: /^Öffnen\s+in Zeiterfassung/ }))

    expect(screen.getByRole('button', { name: 'Zeiterfassung' })).toHaveAttribute('aria-current', 'page')
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

    await userEvent.click(await screen.findByRole('button', { name: /Konzept/ }))

    expect(screen.getByRole('button', { name: 'Zeiterfassung' })).toHaveAttribute('aria-current', 'page')
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

    await userEvent.click(await screen.findByRole('button', { name: 'Abrechnung für Muster GmbH öffnen' }))

    expect(screen.getByRole('button', { name: 'Berichte' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText('Kunde')).toHaveValue('1')
    expect(api.getMonthlyReport).toHaveBeenCalledWith(1, 8, 2026)
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
