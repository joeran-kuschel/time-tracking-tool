import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from './test/axe'
import App from './App'
import { api, ApiError } from './api'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: {
    getCustomers: vi.fn(),
    createCustomer: vi.fn(),
    getActiveEntry: vi.fn(),
    getProjects: vi.fn(),
    getTimeEntries: vi.fn(),
    stopTimeEntry: vi.fn(),
  },
}))

const running = {
  id: 42, project_id: 7, project_name: 'Website', customer_id: 1, description: null,
  start_time: new Date().toISOString(),
}

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

    const input = await screen.findByPlaceholderText('Neuer Kunde')
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
    expect(await screen.findByRole('button', { name: /Website/ })).toBeInTheDocument()

    await userEvent.type(screen.getByPlaceholderText('Neuer Kunde'), 'Neu AG')
    await userEvent.click(screen.getAllByRole('button', { name: '+ Hinzufügen' })[0])

    expect(await screen.findByRole('button', { name: 'Neu AG' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Website/ })).toBeInTheDocument()
  })

  test('has no detectable accessibility violations with a running timer', async () => {
    api.getCustomers.mockResolvedValue([])
    api.getActiveEntry.mockResolvedValue(running)
    render(<App />)
    await screen.findByText(/Timer läuft: Website/)

    expect(await axe(document.body)).toHaveNoViolations()
  })
})
