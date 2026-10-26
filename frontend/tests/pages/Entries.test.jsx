import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, renderWithRouter as render, screen, waitFor, within } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import Entries from '@/pages/Entries'
import { api, ApiError } from '@/api'
import { switchLocale } from '@/i18n'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { searchTimeEntries: vi.fn(), getProjects: vi.fn() },
}))

const customers = [{ id: 1, name: 'Muster GmbH' }, { id: 2, name: 'Neu AG' }]
const entry = (id, overrides = {}) => ({
  id, project_id: 7, project_name: 'Website', customer_id: 1, customer_name: 'Muster GmbH', hourly_rate: '95.00',
  start_time: '2026-09-21T08:00:00Z', end_time: '2026-09-21T09:30:00Z', description: `Eintrag ${id}`, ...overrides,
})
const answer = (entries, total = entries.length, hours = 3) => ({ entries, total, hours, limit: 50, offset: 0 })

const lastQuery = () => api.searchTimeEntries.mock.lastCall[0]
const lastPaging = () => api.searchTimeEntries.mock.lastCall[1]
const status = () => screen.getByRole('status')
const searchField = () => screen.getByLabelText('In Beschreibungen suchen')

// A promise that is settled by hand
function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const renderPage = (props = {}) => render(<Entries customers={customers} {...props} />)

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  api.getProjects.mockResolvedValue([{ id: 7, name: 'Website' }, { id: 8, name: 'Wartung' }])
  api.searchTimeEntries.mockResolvedValue(answer([entry(1), entry(2)]))
  // Only the date is fake, so the page opens in September 2026; userEvent and the debounce need real timers
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 22, 12, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Entries', () => {
  test('has the page heading in the same style as the Dashboard heading, and a results section', async () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Einträge' })).toHaveClass('font-serif', 'text-4xl', 'font-semibold', 'leading-tight')
    expect(screen.getByRole('heading', { level: 1, name: 'Einträge' })).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Ergebnisse' })).toBeInTheDocument()
  })

  test('searches the current month, newest first, 50 at a time, on opening', async () => {
    renderPage()

    await screen.findByText('Eintrag 1')
    expect(api.searchTimeEntries).toHaveBeenCalledTimes(1)
    expect(lastQuery()).toEqual({ from: '2026-09-01', to: '2026-09-30', sort: 'newest' })
    expect(lastPaging()).toEqual({ limit: 50, offset: 0 })
  })

  test('shows the entries with their customer, project, time, hours and description', async () => {
    api.searchTimeEntries.mockResolvedValue(answer([
      entry(1),
      entry(2, { end_time: null, description: null, start_time: '2026-09-22T08:00:00Z' }),
    ]))
    renderPage()

    const table = await screen.findByRole('table')
    const columns = within(table).getAllByRole('columnheader').map((th) => th.textContent)
    expect(columns).toEqual(['Datum', 'Kunde', 'Projekt', 'Zeit', 'Stunden', 'Beschreibung', 'Aktionen'])
    const rows = within(table).getAllByRole('row')
    expect(within(rows[1]).getByText('Muster GmbH')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Website')).toBeInTheDocument()
    expect(within(rows[1]).getByText('1,50 h')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Eintrag 1')).toBeInTheDocument()
    expect(within(rows[2]).getByText('läuft')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Ohne Beschreibung')).toBeInTheDocument()
  })

  describe('status line', () => {
    test('says how many entries and hours were found', async () => {
      api.searchTimeEntries.mockResolvedValue(answer([entry(1), entry(2)], 2, 3))
      renderPage()

      await waitFor(() => expect(status()).toHaveTextContent('2 Einträge, 3,00 h'))
    })

    test('uses the singular for one entry', async () => {
      api.searchTimeEntries.mockResolvedValue(answer([entry(1)], 1, 1.5))
      renderPage()

      await waitFor(() => expect(status()).toHaveTextContent('1 Eintrag, 1,50 h'))
    })

    test('counts all matches, not only the loaded ones', async () => {
      api.searchTimeEntries.mockResolvedValue(answer([entry(1)], 120, 40))
      renderPage()

      await waitFor(() => expect(status()).toHaveTextContent('120 Einträge, 40,00 h'))
    })

    test('says when nothing was found', async () => {
      api.searchTimeEntries.mockResolvedValue(answer([], 0, 0))
      renderPage()

      await waitFor(() => expect(status()).toHaveTextContent('Keine Einträge gefunden'))
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    test('is polite and atomic, and says nothing before the first answer', async () => {
      const first = deferred()
      api.searchTimeEntries.mockReturnValue(first.promise)
      renderPage()

      expect(status()).toHaveAttribute('aria-live', 'polite')
      expect(status()).toHaveAttribute('aria-atomic', 'true')
      expect(status()).toBeEmptyDOMElement()
      await act(async () => first.resolve(answer([entry(1)])))
      expect(status()).not.toBeEmptyDOMElement()
    })

    test('keeps its text while the next search is loading', async () => {
      renderPage()
      await waitFor(() => expect(status()).toHaveTextContent('2 Einträge'))
      const next = deferred()
      api.searchTimeEntries.mockReturnValue(next.promise)

      await userEvent.selectOptions(screen.getByLabelText('Sortierung'), 'Älteste zuerst')

      expect(status()).toHaveTextContent('2 Einträge, 3,00 h')
      await act(async () => next.resolve(answer([entry(5)], 1, 1)))
      expect(status()).toHaveTextContent('1 Eintrag, 1,00 h')
    })
  })

  describe('searching', () => {
    test('sends one request for a typed text, after a pause', async () => {
      renderPage()
      await screen.findByText('Eintrag 1')

      await userEvent.type(searchField(), 'Konzept')
      expect(api.searchTimeEntries).toHaveBeenCalledTimes(1)

      await waitFor(() => expect(api.searchTimeEntries).toHaveBeenCalledTimes(2))
      await new Promise((resolve) => setTimeout(resolve, 450))
      expect(api.searchTimeEntries).toHaveBeenCalledTimes(2)
      expect(lastQuery()).toMatchObject({ q: 'Konzept', from: '2026-09-01' })
    })

    test('applies the text at once on Enter', async () => {
      renderPage()
      await screen.findByText('Eintrag 1')

      await userEvent.type(searchField(), 'Konzept{Enter}')

      expect(api.searchTimeEntries).toHaveBeenCalledTimes(2)
      expect(lastQuery().q).toBe('Konzept')
    })

    test('applies the other filters at once', async () => {
      renderPage()
      await screen.findByText('Eintrag 1')

      await userEvent.selectOptions(screen.getByLabelText('Kunde'), 'Neu AG')
      expect(lastQuery()).toMatchObject({ customerId: '2' })
      expect(api.getProjects).toHaveBeenCalledWith('2')

      await userEvent.selectOptions(await screen.findByRole('option', { name: 'Wartung' }).then(() => screen.getByLabelText('Projekt')), 'Wartung')
      expect(lastQuery()).toMatchObject({ customerId: '2', projectId: '8' })

      await userEvent.selectOptions(screen.getByLabelText('Zeitraum'), 'Beliebig')
      expect(lastQuery()).not.toHaveProperty('from')
      expect(lastQuery()).not.toHaveProperty('to')

      await userEvent.selectOptions(screen.getByLabelText('Sortierung'), 'Älteste zuerst')
      expect(lastQuery().sort).toBe('oldest')
    })

    test('clears the search text at once when the field is emptied', async () => {
      renderPage()
      await screen.findByText('Eintrag 1')
      await userEvent.type(searchField(), 'a{Enter}')

      await userEvent.clear(searchField())

      expect(lastQuery()).not.toHaveProperty('q')
    })

    test('ignores the answer to an older search', async () => {
      const first = deferred()
      const second = deferred()
      api.searchTimeEntries.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
      renderPage()

      await userEvent.selectOptions(screen.getByLabelText('Sortierung'), 'Älteste zuerst')
      await act(async () => second.resolve(answer([entry(2, { description: 'neu' })], 1, 1)))
      await act(async () => first.resolve(answer([entry(1, { description: 'alt' })], 1, 1)))

      expect(screen.getByText('neu')).toBeInTheDocument()
      expect(screen.queryByText('alt')).not.toBeInTheDocument()
    })

    test('keeps the old results, marked busy, while loading', async () => {
      renderPage()
      await screen.findByText('Eintrag 1')
      const results = screen.getByRole('region', { name: 'Ergebnisse' })
      expect(results).toHaveAttribute('aria-busy', 'false')
      const next = deferred()
      api.searchTimeEntries.mockReturnValue(next.promise)

      await userEvent.selectOptions(screen.getByLabelText('Sortierung'), 'Älteste zuerst')

      expect(results).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByText('Eintrag 1')).toBeInTheDocument()
      await act(async () => next.resolve(answer([entry(3)])))
      expect(results).toHaveAttribute('aria-busy', 'false')
    })

    test('shows an error and keeps the old results when a search fails', async () => {
      renderPage()
      await screen.findByText('Eintrag 1')
      api.searchTimeEntries.mockRejectedValue(new ApiError(500, 'boom'))

      await userEvent.selectOptions(screen.getByLabelText('Sortierung'), 'Älteste zuerst')

      expect(await screen.findByRole('alert')).toHaveTextContent('Einträge konnten nicht geladen werden. Bitte versuche es erneut.')
      expect(screen.getByText('Eintrag 1')).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Ergebnisse' })).toHaveAttribute('aria-busy', 'false')
    })

    test('says so when the server is not reachable', async () => {
      api.searchTimeEntries.mockRejectedValue(new ApiError(0, 'Server not reachable'))
      renderPage()

      expect(await screen.findByRole('alert')).toHaveTextContent('Der Server ist nicht erreichbar.')
    })

    test('does not send a period that ends before it starts, and keeps the results', async () => {
      renderPage()
      await screen.findByText('Eintrag 1')

      fireEvent.change(screen.getByLabelText('Bis'), { target: { value: '2026-08-01' } })

      expect(screen.getByText('Das Enddatum darf nicht vor dem Startdatum liegen.')).toBeInTheDocument()
      expect(api.searchTimeEntries).toHaveBeenCalledTimes(1)
      expect(screen.getByText('Eintrag 1')).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('Bis'), { target: { value: '2026-09-15' } })
      await waitFor(() => expect(api.searchTimeEntries).toHaveBeenCalledTimes(2))
      expect(lastQuery()).toMatchObject({ from: '2026-09-01', to: '2026-09-15' })
    })

    test('shows an error when the projects cannot be loaded', async () => {
      api.getProjects.mockRejectedValue(new ApiError(500, 'boom'))
      renderPage()
      await screen.findByText('Eintrag 1')

      await userEvent.selectOptions(screen.getByLabelText('Kunde'), 'Muster GmbH')

      expect(await screen.findByRole('alert')).toHaveTextContent('Projekte konnten nicht geladen werden.')
    })
  })

  describe('Reset', () => {
    test('searches everything, newest first: no text, customer, project or dates', async () => {
      renderPage()
      await screen.findByText('Eintrag 1')
      await userEvent.type(searchField(), 'Konzept{Enter}')
      await userEvent.selectOptions(screen.getByLabelText('Kunde'), 'Muster GmbH')
      await userEvent.selectOptions(screen.getByLabelText('Sortierung'), 'Älteste zuerst')

      await userEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }))

      await waitFor(() => expect(lastQuery()).toEqual({ sort: 'newest' }))
      expect(lastPaging()).toEqual({ limit: 50, offset: 0 })
      expect(screen.getByLabelText('Zeitraum')).toHaveValue('any')
      expect(searchField()).toHaveValue('')
      expect(searchField()).toHaveFocus()
    })

    test('does not bring the current month back', async () => {
      renderPage()
      await screen.findByText('Eintrag 1')

      await userEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }))

      await waitFor(() => expect(lastQuery()).toEqual({ sort: 'newest' }))
      expect(screen.getByText('Keine Filter aktiv')).toBeInTheDocument()
    })
  })

  describe('Show more', () => {
    const firstPage = answer([entry(1), entry(2)], 3, 4.5)

    test('shows how many are shown and loads the next page, appending it', async () => {
      api.searchTimeEntries.mockResolvedValueOnce(firstPage).mockResolvedValueOnce({ ...answer([entry(3)], 3, 4.5), offset: 2 })
      renderPage()

      expect(await screen.findByText('2 von 3 angezeigt')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Mehr anzeigen' }))

      await screen.findByText('Eintrag 3')
      expect(lastPaging()).toEqual({ limit: 50, offset: 2 })
      expect(lastQuery()).toEqual({ from: '2026-09-01', to: '2026-09-30', sort: 'newest' })
      expect(screen.getByText('Eintrag 1')).toBeInTheDocument()
      expect(screen.getAllByRole('row')).toHaveLength(4)
      expect(screen.queryByRole('button', { name: 'Mehr anzeigen' })).not.toBeInTheDocument()
      expect(status()).toHaveTextContent('3 Einträge, 4,50 h')
    })

    test('moves focus to the list when the button goes away', async () => {
      api.searchTimeEntries.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(answer([entry(3)], 3, 4.5))
      renderPage()

      await userEvent.click(await screen.findByRole('button', { name: 'Mehr anzeigen' }))

      await screen.findByText('Eintrag 3')
      expect(screen.getByRole('table').parentElement).toHaveFocus()
    })

    test('does not take focus from the search field when a later search leaves few results', async () => {
      api.searchTimeEntries.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(answer([entry(3)], 3, 4.5))
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Mehr anzeigen' }))
      await screen.findByText('Eintrag 3')
      api.searchTimeEntries.mockResolvedValue(answer([entry(8)], 1, 1))

      await userEvent.type(searchField(), 'x{Enter}')

      await screen.findByText('Eintrag 8')
      expect(searchField()).toHaveFocus()
    })

    test('does not take focus after a failed Show more and a new search', async () => {
      api.searchTimeEntries.mockResolvedValueOnce(firstPage).mockRejectedValueOnce(new ApiError(500, 'boom'))
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Mehr anzeigen' }))
      await screen.findByRole('alert')
      api.searchTimeEntries.mockResolvedValue(answer([entry(8)], 1, 1))

      await userEvent.type(searchField(), 'x{Enter}')

      await screen.findByText('Eintrag 8')
      expect(searchField()).toHaveFocus()
    })

    test('adds only entries that are not shown yet when a page overlaps', async () => {
      api.searchTimeEntries.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(answer([entry(2), entry(3)], 3, 4.5))
      renderPage()

      await userEvent.click(await screen.findByRole('button', { name: 'Mehr anzeigen' }))

      await screen.findByText('Eintrag 3')
      expect(screen.getAllByText('Eintrag 2')).toHaveLength(1)
      expect(screen.getAllByRole('row')).toHaveLength(4)
    })

    test('keeps the button and the old entries when loading more fails', async () => {
      api.searchTimeEntries.mockResolvedValueOnce(firstPage).mockRejectedValueOnce(new ApiError(500, 'boom'))
      renderPage()

      await userEvent.click(await screen.findByRole('button', { name: 'Mehr anzeigen' }))

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Eintrag 2')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Mehr anzeigen' })).toBeInTheDocument()
    })

    test('ignores a second click while loading', async () => {
      const more = deferred()
      api.searchTimeEntries.mockResolvedValueOnce(firstPage).mockReturnValueOnce(more.promise)
      renderPage()

      const button = await screen.findByRole('button', { name: 'Mehr anzeigen' })
      await userEvent.click(button)
      await userEvent.click(button)

      expect(api.searchTimeEntries).toHaveBeenCalledTimes(2)
      await act(async () => more.resolve(answer([entry(3)], 3)))
    })

    test('drops a pending page when the filters change', async () => {
      const more = deferred()
      api.searchTimeEntries.mockResolvedValueOnce(firstPage).mockReturnValueOnce(more.promise).mockResolvedValueOnce(answer([entry(9, { description: 'neu' })], 1, 1))
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Mehr anzeigen' }))

      await userEvent.selectOptions(screen.getByLabelText('Sortierung'), 'Älteste zuerst')
      await act(async () => more.resolve({ ...answer([entry(3, { description: 'spät' })], 3), offset: 2 }))

      expect(await screen.findByText('neu')).toBeInTheDocument()
      expect(screen.queryByText('spät')).not.toBeInTheDocument()
      expect(screen.queryByText('Eintrag 1')).not.toBeInTheDocument()
    })
  })

  describe('Open in Time tracking', () => {
    test('links to the customer and project of the entry', async () => {
      api.searchTimeEntries.mockResolvedValue(answer([entry(1, { customer_id: 2, customer_name: 'Neu AG', project_id: 8 })]))
      renderPage()

      expect(await screen.findByRole('link', { name: /^Öffnen\s+in Zeiterfassung\s*: Neu AG/ })).toHaveAttribute('href', '/time-tracking/2/8')
    })

    test('shows only Open as the visible label, while the name says where it opens', async () => {
    renderPage()

    const button = (await screen.findAllByRole('link', { name: /^Öffnen\s+in Zeiterfassung\s*: Muster GmbH, / }))[0]
    expect(button.firstChild.textContent).toBe('Öffnen')
  })

  test('has no edit or delete action', async () => {
      renderPage()
      await screen.findByText('Eintrag 1')

      expect(screen.queryByRole('button', { name: /bearbeiten|löschen/i })).not.toBeInTheDocument()
    })
  })

  test('has no accessibility violations, in German and English, with results and without', async () => {
    const { container } = renderPage()
    await screen.findByText('Eintrag 1')
    expect(await axe(container)).toHaveNoViolations()

    act(() => switchLocale('en'))
    expect(screen.getByRole('heading', { level: 1, name: 'Entries' })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()

    api.searchTimeEntries.mockResolvedValue(answer([], 0, 0))
    await userEvent.selectOptions(screen.getByLabelText('Sort'), 'Oldest first')
    await screen.findByText('No entries found')
    expect(await axe(container)).toHaveNoViolations()
  })

  test('starts again with the current month when the page is opened anew', async () => {
    const { unmount } = renderPage()
    await screen.findByText('Eintrag 1')
    await userEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }))
    unmount()

    renderPage()

    await waitFor(() => expect(lastQuery()).toEqual({ from: '2026-09-01', to: '2026-09-30', sort: 'newest' }))
  })

  describe('further cases', () => {
    test('says the counts in English, with the singular and the plural', async () => {
      api.searchTimeEntries.mockResolvedValueOnce(answer([entry(1)], 1, 1.5)).mockResolvedValueOnce(answer([entry(1), entry(2)], 2, 3))
      renderPage()
      await waitFor(() => expect(status()).toHaveTextContent('1 Eintrag'))
      act(() => switchLocale('en'))
      expect(status()).toHaveTextContent('1 entry, 1.50 h')

      await userEvent.selectOptions(screen.getByLabelText('Sort'), 'Oldest first')

      await waitFor(() => expect(status()).toHaveTextContent('2 entries, 3.00 h'))
    })

    test('says how many of the matches are shown, in English', async () => {
      api.searchTimeEntries.mockResolvedValue(answer([entry(1), entry(2)], 5, 4))
      renderPage()
      await screen.findByText('2 von 5 angezeigt')

      act(() => switchLocale('en'))

      expect(screen.getByText('Showing 2 of 5')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument()
    })

    test('does not search again for a text of only spaces', async () => {
      renderPage()
      await screen.findByText('Eintrag 1')

      await userEvent.type(searchField(), '   {Enter}')
      await new Promise((resolve) => setTimeout(resolve, 400))

      expect(api.searchTimeEntries).toHaveBeenCalledTimes(1)
    })

    test('trims the typed text before searching', async () => {
      renderPage()
      await screen.findByText('Eintrag 1')

      await userEvent.type(searchField(), '  Konzept  {Enter}')

      expect(lastQuery().q).toBe('Konzept')
    })

    test('does not search the old text after a reset while the pause was running', async () => {
      renderPage()
      await screen.findByText('Eintrag 1')
      await userEvent.type(searchField(), 'Konzept')

      await userEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }))
      await waitFor(() => expect(lastQuery()).toEqual({ sort: 'newest' }))
      const calls = api.searchTimeEntries.mock.calls.length
      await new Promise((resolve) => setTimeout(resolve, 450))

      expect(api.searchTimeEntries).toHaveBeenCalledTimes(calls)
      expect(lastQuery()).toEqual({ sort: 'newest' })
    })

    test('changing the customer drops the chosen project from the search', async () => {
      renderPage()
      await screen.findByText('Eintrag 1')
      await userEvent.selectOptions(screen.getByLabelText('Kunde'), 'Muster GmbH')
      await userEvent.selectOptions(await screen.findByRole('option', { name: 'Wartung' }).then(() => screen.getByLabelText('Projekt')), 'Wartung')
      expect(lastQuery()).toMatchObject({ customerId: '1', projectId: '8' })

      await userEvent.selectOptions(screen.getByLabelText('Kunde'), 'Neu AG')

      expect(lastQuery()).toMatchObject({ customerId: '2' })
      expect(lastQuery()).not.toHaveProperty('projectId')
    })

    test('removing the customer chip searches all customers and projects again', async () => {
      renderPage()
      await screen.findByText('Eintrag 1')
      await userEvent.selectOptions(screen.getByLabelText('Kunde'), 'Muster GmbH')
      await userEvent.selectOptions(await screen.findByRole('option', { name: 'Wartung' }).then(() => screen.getByLabelText('Projekt')), 'Wartung')

      await userEvent.click(screen.getByRole('button', { name: /Filter entfernen: Kunde: Muster GmbH/ }))

      expect(lastQuery()).toEqual({ from: '2026-09-01', to: '2026-09-30', sort: 'newest' })
      expect(screen.getByLabelText('Projekt')).toBeDisabled()
    })

    test('ignores the projects of a customer that is no longer chosen', async () => {
      const slow = deferred()
      api.getProjects.mockReturnValueOnce(slow.promise).mockResolvedValueOnce([{ id: 8, name: 'Wartung' }])
      renderPage()
      await screen.findByText('Eintrag 1')

      await userEvent.selectOptions(screen.getByLabelText('Kunde'), 'Muster GmbH')
      await userEvent.selectOptions(screen.getByLabelText('Kunde'), 'Neu AG')
      await screen.findByRole('option', { name: 'Wartung' })
      await act(async () => slow.resolve([{ id: 7, name: 'Website' }]))

      expect(screen.queryByRole('option', { name: 'Website' })).not.toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Wartung' })).toBeInTheDocument()
    })

    test('hides the error of a failed search when the next search works', async () => {
      renderPage()
      await screen.findByText('Eintrag 1')
      api.searchTimeEntries.mockRejectedValueOnce(new ApiError(500, 'boom'))
      await userEvent.selectOptions(screen.getByLabelText('Sortierung'), 'Älteste zuerst')
      await screen.findByRole('alert')

      await userEvent.selectOptions(screen.getByLabelText('Sortierung'), 'Neueste zuerst')

      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    })

    test('shows no results and no alert before a failed first search is retried', async () => {
      api.searchTimeEntries.mockRejectedValueOnce(new ApiError(500, 'boom'))
      renderPage()

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      expect(status()).toBeEmptyDOMElement()
      expect(screen.getByRole('region', { name: 'Ergebnisse' })).toHaveAttribute('aria-busy', 'false')
    })

    test('keeps focus on Show more while the next page loads, and retries after an error', async () => {
      const more = deferred()
      api.searchTimeEntries
        .mockResolvedValueOnce(answer([entry(1), entry(2)], 4, 4))
        .mockReturnValueOnce(more.promise)
        .mockResolvedValueOnce(answer([entry(3), entry(4)], 4, 4))
      renderPage()
      const button = await screen.findByRole('button', { name: 'Mehr anzeigen' })

      await userEvent.click(button)
      expect(button).toHaveFocus()
      expect(screen.getByRole('region', { name: 'Ergebnisse' })).toHaveAttribute('aria-busy', 'true')
      await act(async () => more.reject(new ApiError(500, 'boom')))
      await screen.findByRole('alert')
      await userEvent.click(screen.getByRole('button', { name: 'Mehr anzeigen' }))

      await screen.findByText('Eintrag 4')
      expect(lastPaging()).toEqual({ limit: 50, offset: 2 })
      expect(screen.getAllByRole('row')).toHaveLength(5)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    test('a later page replaces the total and hours of the first answer', async () => {
      api.searchTimeEntries
        .mockResolvedValueOnce(answer([entry(1), entry(2)], 3, 3))
        .mockResolvedValueOnce(answer([entry(3)], 3, 4.25))
      renderPage()

      await userEvent.click(await screen.findByRole('button', { name: 'Mehr anzeigen' }))

      await waitFor(() => expect(status()).toHaveTextContent('3 Einträge, 4,25 h'))
    })
  })
})
