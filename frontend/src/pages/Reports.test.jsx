import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Reports from './Reports'
import { api, ApiError } from '../api'

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { getMonthlyReport: vi.fn() },
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
})
