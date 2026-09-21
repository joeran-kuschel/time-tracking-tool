import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, within } from './test/render'
import userEvent from '@testing-library/user-event'
import { axe } from './test/axe'
import App from './App'
import { api, ApiError } from './api'
import { fromInputs } from './entryTime'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: {
    getCustomers: vi.fn(),
    createCustomer: vi.fn(),
    getActiveEntry: vi.fn(),
    getProjects: vi.fn(),
    getTimeEntries: vi.fn(),
    stopTimeEntry: vi.fn(),
    createTimeEntry: vi.fn(),
    updateCustomer: vi.fn(),
    deleteCustomer: vi.fn(),
  },
}))

const running = {
  id: 42, project_id: 7, project_name: 'Website', customer_id: 1, description: null,
  start_time: new Date().toISOString(),
}

// The name field of the "new customer" form
const newCustomerName = async (legend = 'Neuer Kunde') =>
  within(await screen.findByRole('group', { name: legend })).getByLabelText('Name')

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  api.getActiveEntry.mockResolvedValue(null)
  api.getProjects.mockResolvedValue([{ id: 7, name: 'Website', hourly_rate: '80.00' }])
  api.getTimeEntries.mockResolvedValue([])
})

describe('App', () => {
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

    expect(await screen.findByRole('button', { name: 'Muster GmbH' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('keeps the typed name and shows an error when adding a customer fails', async () => {
    api.getCustomers.mockResolvedValue([])
    api.createCustomer.mockRejectedValue(new ApiError(500, 'boom'))
    render(<App />)

    const input = await newCustomerName()
    await userEvent.type(input, 'Muster GmbH')
    await userEvent.click(screen.getByRole('button', { name: '+ Hinzufügen' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Kunde konnte nicht angelegt werden.')
    expect(input).toHaveValue('Muster GmbH')
  })

  test('resumes a running timer after a reload', async () => {
    api.getCustomers.mockResolvedValue([])
    api.getActiveEntry.mockResolvedValue(running)
    render(<App />)

    expect(await screen.findByText(/Timer läuft: Website/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  test('after a reload, selects the customer and project of the running timer', async () => {
    api.getCustomers.mockResolvedValue([{ id: 1, name: 'Muster GmbH' }])
    api.getProjects.mockResolvedValue([{ id: 3, name: 'Andere', hourly_rate: '50.00' }, { id: 7, name: 'Website', hourly_rate: '80.00' }])
    api.getActiveEntry.mockResolvedValue(running)
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Einträge für Website' })).toBeInTheDocument()
    expect(api.getProjects).toHaveBeenCalledWith(1)
  })

  test('keeps focus on the timer button after stopping a resumed timer', async () => {
    api.getCustomers.mockResolvedValue([])
    api.getActiveEntry.mockResolvedValue(running)
    api.stopTimeEntry.mockResolvedValue({ ...running, end_time: new Date().toISOString() })
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Stop' }))

    expect(await screen.findByRole('button', { name: 'Start' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Timer gestoppt')
    expect(screen.queryByText(/Timer läuft/)).not.toBeInTheDocument()
  })

  test('keeps the running timer when switching pages', async () => {
    api.getCustomers.mockResolvedValue([])
    api.getActiveEntry.mockResolvedValue(running)
    render(<App />)
    await screen.findByText(/Timer läuft: Website/)

    await userEvent.click(screen.getByRole('button', { name: 'Berichte' }))
    expect(screen.getByText(/Timer läuft: Website/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(api.getActiveEntry).toHaveBeenCalledTimes(1)
  })

  test('keeps the selected customer after adding another one', async () => {
    api.getCustomers
      .mockResolvedValueOnce([{ id: 1, name: 'Muster GmbH' }])
      .mockResolvedValueOnce([{ id: 1, name: 'Muster GmbH' }, { id: 2, name: 'Neu AG' }])
    api.createCustomer.mockResolvedValue({ id: 2, name: 'Neu AG' })
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Muster GmbH' }))
    expect(await screen.findByRole('button', { name: /Website/, pressed: true })).toBeInTheDocument()

    await userEvent.type(await newCustomerName(), 'Neu AG')
    await userEvent.click(screen.getAllByRole('button', { name: '+ Hinzufügen' })[0])

    expect(await screen.findByRole('button', { name: 'Neu AG' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Website/, pressed: true })).toBeInTheDocument()
  })

  test('has no detectable accessibility violations with a running timer', async () => {
    api.getCustomers.mockResolvedValue([])
    api.getActiveEntry.mockResolvedValue(running)
    render(<App />)
    await screen.findByText(/Timer läuft: Website/)

    expect(await axe(document.body)).toHaveNoViolations()
  })

  test('switches to English without a reload and keeps the running timer and typed text', async () => {
    api.getCustomers.mockResolvedValue([])
    api.getActiveEntry.mockResolvedValue(running)
    render(<App />)
    await screen.findByText(/Timer läuft: Website/)
    await userEvent.type(await newCustomerName(), 'Muster GmbH')

    await userEvent.click(screen.getByRole('button', { name: 'English' }))

    expect(screen.getByText(/Timer running: Website/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(await newCustomerName('New customer')).toHaveValue('Muster GmbH')
    expect(screen.getByRole('button', { name: 'Reports' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
    expect(api.getActiveEntry).toHaveBeenCalledTimes(1)
    expect(api.getCustomers).toHaveBeenCalledTimes(1)
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
    const { detectLocale, activateLocale } = await import('./i18n')
    activateLocale(detectLocale())
    api.getCustomers.mockResolvedValue([])
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Customers' })).toBeInTheDocument()
  })

  test('adds time manually for the selected project and shows it in the list', async () => {
    const added = { id: 9, project_id: 7, start_time: fromInputs('2026-09-21', '08:00'), end_time: fromInputs('2026-09-21', '09:30'), description: 'Nachgetragen' }
    api.getCustomers.mockResolvedValue([{ id: 1, name: 'Muster GmbH' }])
    api.getTimeEntries.mockResolvedValueOnce([]).mockResolvedValueOnce([added])
    api.createTimeEntry.mockResolvedValue(added)
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Muster GmbH' }))

    await userEvent.click(await screen.findByRole('button', { name: 'Zeit nachtragen' }))
    const form = screen.getByRole('group', { name: 'Zeit nachtragen' })
    await userEvent.clear(within(form).getByLabelText('Datum'))
    await userEvent.type(within(form).getByLabelText('Datum'), '2026-09-21')
    await userEvent.type(within(form).getByLabelText('Start'), '08:00')
    await userEvent.type(within(form).getByLabelText('Ende'), '09:30')
    await userEvent.type(within(form).getByLabelText('Beschreibung (optional)'), 'Nachgetragen')
    await userEvent.click(within(form.closest('form')).getByRole('button', { name: 'Speichern' }))

    expect(api.createTimeEntry).toHaveBeenCalledWith(7, fromInputs('2026-09-21', '08:00'), 'Nachgetragen', fromInputs('2026-09-21', '09:30'))
    expect(await screen.findByText('Nachgetragen')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Zeit nachtragen' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zeit nachtragen' })).toHaveFocus()
  })

  test('renaming the selected customer keeps it and its project selected', async () => {
    api.getCustomers
      .mockResolvedValueOnce([{ id: 1, name: 'Muster GmbH' }])
      .mockResolvedValueOnce([{ id: 1, name: 'Muster AG' }])
    api.updateCustomer.mockResolvedValue({ id: 1, name: 'Muster AG' })
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Muster GmbH' }))
    await screen.findByRole('heading', { name: 'Einträge für Website' })

    await userEvent.click(screen.getByRole('button', { name: 'Muster GmbH bearbeiten' }))
    const name = within(screen.getByRole('list', { name: 'Kunden' })).getByLabelText('Name')
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
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Muster GmbH' }))
    await screen.findByRole('heading', { name: 'Einträge für Website' })

    await userEvent.click(screen.getByRole('button', { name: 'Muster GmbH löschen' }))
    expect(screen.getByRole('group', { name: 'Muster GmbH und alle Projekte und Zeiteinträge löschen?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }))

    expect(api.deleteCustomer).toHaveBeenCalledWith(1)
    expect(await screen.findByText('Wähle einen Kunden')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Einträge für/ })).not.toBeInTheDocument()
  })
})
