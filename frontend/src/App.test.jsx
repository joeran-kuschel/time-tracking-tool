import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from './test/axe'
import App from './App'
import { api, ApiError } from './api'

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { getCustomers: vi.fn(), createCustomer: vi.fn() },
}))

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
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
})
