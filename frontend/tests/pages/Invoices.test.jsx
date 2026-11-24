import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, renderWithRouter, screen, waitFor, within } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import Invoices from '@/pages/Invoices'
import { api, ApiError } from '@/api'
import { activateLocale, switchLocale } from '@/i18n'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { previewInvoice: vi.fn(), createInvoice: vi.fn(), getInvoices: vi.fn(), deleteInvoice: vi.fn(), downloadInvoicePdf: vi.fn(), invoicePdfUrl: (id) => `/api/invoices/${id}/pdf?inline=1` },
}))

const customers = [{ id: 1, name: 'Muster GmbH' }, { id: 2, name: 'Neu AG', report_language: 'en' }]
const preview = {
  customer: { id: 1, name: 'Muster GmbH' }, from: '2026-02-01', to: '2026-02-28', invoiceDate: '2026-03-05', language: 'de', number: '2026-0007',
  lines: [
    { projectId: 2, name: 'Beratung', minutes: 90, hours: '1.50', hourlyRate: '95.00', amount: '142.50' },
    { projectId: 1, name: 'Website', minutes: 750, hours: '12.50', hourlyRate: '80.00', amount: '1000.00' },
  ],
  currency: 'EUR', vatMode: 'regular', vatRate: 19, net: '1142.50', vat: '217.08', gross: '1359.58', missing: [],
}
const created = { id: 9, number: '2026-0007', customerId: 1, customerName: 'Muster GmbH', invoiceDate: '2026-03-05', periodFrom: '2026-02-01', periodTo: '2026-02-28', language: 'de', gross: '1359.58' }
const invoices = [
  { id: 4, number: '2026-0004', customerId: 1, customerName: 'Muster GmbH', invoiceDate: '2026-02-03', periodFrom: '2026-01-01', periodTo: '2026-01-31', language: 'de', gross: '500.00' },
  { id: 3, number: '2026-0003', customerId: null, customerName: 'Alt AG', invoiceDate: '2026-01-05', periodFrom: '2025-12-01', periodTo: '2025-12-31', language: 'de', gross: '99.90' },
]
const REQUEST = { customerId: 1, from: '2026-02-01', to: '2026-02-28', invoiceDate: '2026-03-05', lang: 'de', groupByTask: false }

const renderPage = (customerList = customers) => renderWithRouter(<Invoices customers={customerList} />, { route: '/invoices' })
const customerSelect = () => screen.getByLabelText('Kunde')
const fromField = () => screen.getByLabelText('Von')
const toField = () => screen.getByLabelText('Bis')
const dateField = () => screen.getByLabelText('Rechnungsdatum')
const setDay = (field, value) => fireEvent.change(field, { target: { value } })
const selectCustomer = (name) => userEvent.selectOptions(customerSelect(), name)
const previewCard = () => screen.findByRole('region', { name: 'Rechnung für Muster GmbH' })
const createButton = () => screen.getByRole('button', { name: 'Rechnung erstellen' })

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  // Only the date is fake: the period starts as the month before 5 March 2026, and userEvent needs real timers
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 2, 5, 10, 0))
  api.getInvoices.mockResolvedValue(invoices)
  api.previewInvoice.mockResolvedValue(preview)
})

afterEach(() => {
  vi.useRealTimers()
  activateLocale('de')
})

describe('Invoices', () => {
  describe('the form', () => {
    test('has a heading, labelled fields, and starts with the previous month and today', async () => {
      renderPage()

      expect(screen.getByRole('heading', { level: 1, name: 'Rechnungen' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: 'Neue Rechnung' })).toBeInTheDocument()
      expect(customerSelect()).toHaveValue('')
      expect(fromField()).toHaveValue('2026-02-01')
      expect(toField()).toHaveValue('2026-02-28')
      expect(dateField()).toHaveValue('2026-03-05')
      expect([fromField(), toField(), dateField()].every((field) => field.type === 'date')).toBe(true)
      await screen.findByRole('table', { name: 'Erstellte Rechnungen' })
    })

    test('lists the customers, and asks for one before it prepares anything', async () => {
      renderPage()

      expect(within(customerSelect()).getAllByRole('option').map((option) => option.textContent)).toEqual(['Wähle einen Kunden', 'Muster GmbH', 'Neu AG'])
      expect(screen.getByText('Wähle einen Kunden, um eine Rechnung vorzubereiten.')).toBeInTheDocument()
      await screen.findByRole('table', { name: 'Erstellte Rechnungen' })
      expect(api.previewInvoice).not.toHaveBeenCalled()
    })

    test('works without customers', async () => {
      renderPage([])

      expect(within(customerSelect()).getAllByRole('option')).toHaveLength(1)
      await screen.findByRole('table', { name: 'Erstellte Rechnungen' })
    })
  })

  describe('the preview', () => {
    test('loads by itself when a customer is chosen, with the days, the date and the language', async () => {
      renderPage()
      await selectCustomer('Muster GmbH')

      await previewCard()

      expect(api.previewInvoice).toHaveBeenCalledTimes(1)
      expect(api.previewInvoice).toHaveBeenCalledWith(REQUEST)
    })

    test('rounds per day and task only when asked to, and loads the preview again for it', async () => {
      renderPage()
      await selectCustomer('Muster GmbH')
      await previewCard()

      await userEvent.click(screen.getByRole('checkbox', { name: 'Stunden je Tag und Aufgabe runden' }))

      await waitFor(() => expect(api.previewInvoice).toHaveBeenLastCalledWith({ ...REQUEST, groupByTask: true }))
      expect(api.previewInvoice).toHaveBeenCalledTimes(2)
    })

    test('is off at first, and the checkbox is not checked', async () => {
      renderPage()

      expect(screen.getByRole('checkbox', { name: 'Stunden je Tag und Aufgabe runden' })).not.toBeChecked()
    })

    test('shows the lines with hours, rate and amount, and the totals', async () => {
      renderPage()
      await selectCustomer('Muster GmbH')

      const card = within(await previewCard())

      const table = card.getByRole('table', { name: 'Rechnung für Muster GmbH' })
      const rows = within(table).getAllByRole('row').map((row) => [...row.querySelectorAll('th, td')].map((c) => c.textContent.replace(/\s/g, ' ')))
      expect(rows).toEqual([
        ['Projekt', 'Stunden', 'Satz', 'Betrag'],
        ['Beratung', '1:30 h', '95,00 €/h', '142,50 €'],
        ['Website', '12:30 h', '80,00 €/h', '1.000,00 €'],
        ['Nettobetrag', '1.142,50 €'],
        ['Umsatzsteuer 19 %', '217,08 €'],
        ['Gesamtbetrag', '1.359,58 €'],
      ])
    })

    test('names the period, the invoice date, the number it will get (given later) and the language', async () => {
      renderPage()
      await selectCustomer('Muster GmbH')

      const card = within(await previewCard())

      expect(card.getByText('01.02.2026 bis 28.02.2026, datiert 05.03.2026')).toBeInTheDocument()
      expect(card.getByText('Rechnungsnummer 2026-0007. Sie wird vergeben, wenn du die Rechnung erstellst.')).toBeInTheDocument()
      expect(card.getByText('Die Rechnung ist auf Deutsch (die Sprache der App).')).toBeInTheDocument()
    })

    test("names the customer's own report language", async () => {
      api.previewInvoice.mockResolvedValue({ ...preview, customer: { id: 2, name: 'Neu AG' }, language: 'en' })
      renderPage()
      await selectCustomer('Neu AG')

      const card = within(await screen.findByRole('region', { name: 'Rechnung für Neu AG' }))

      expect(card.getByText('Die Rechnung ist auf Englisch (die Berichtssprache dieses Kunden).')).toBeInTheDocument()
    })

    test('a small business has only the total and the sentence about section 19 UStG', async () => {
      api.previewInvoice.mockResolvedValue({ ...preview, vatMode: 'small_business', vat: '0.00', gross: '1142.50' })
      renderPage()
      await selectCustomer('Muster GmbH')

      const card = within(await previewCard())

      expect(card.queryByText('Nettobetrag')).not.toBeInTheDocument()
      expect(card.queryByText(/Umsatzsteuer 19/)).not.toBeInTheDocument()
      expect(card.getByText('Gesamtbetrag').nextElementSibling).toHaveTextContent('1.142,50 €')
      expect(card.getByText('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.')).toBeInTheDocument()
    })

    test('announces the total in a status region that is always in the page, not only in the table', async () => {
      renderPage()
      const status = () => screen.getAllByRole('status').find((element) => element.classList.contains('sr-only'))
      expect(status()).toBeEmptyDOMElement()

      await selectCustomer('Muster GmbH')
      await previewCard()

      await waitFor(() => expect(status()).toHaveTextContent('Die Rechnung hätte insgesamt 1.359,58 €.'))
      expect((await previewCard()).querySelector('tfoot')).not.toHaveAttribute('aria-live')
    })

    test('loads again when the customer, a day or the invoice date changes', async () => {
      renderPage()
      await selectCustomer('Muster GmbH')
      await previewCard()

      setDay(fromField(), '2026-02-10')
      await waitFor(() => expect(api.previewInvoice).toHaveBeenLastCalledWith({ ...REQUEST, from: '2026-02-10' }))
      setDay(toField(), '2026-02-20')
      await waitFor(() => expect(api.previewInvoice).toHaveBeenLastCalledWith({ ...REQUEST, from: '2026-02-10', to: '2026-02-20' }))
      setDay(dateField(), '2026-04-01')
      await waitFor(() => expect(api.previewInvoice).toHaveBeenLastCalledWith({ ...REQUEST, from: '2026-02-10', to: '2026-02-20', invoiceDate: '2026-04-01' }))
      await selectCustomer('Neu AG')
      await waitFor(() => expect(api.previewInvoice).toHaveBeenLastCalledWith(expect.objectContaining({ customerId: 2 })))
    })

    test('shows only the answer for the current choice when an older one arrives late', async () => {
      let resolveFirst
      api.previewInvoice
        .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
        .mockResolvedValueOnce({ ...preview, customer: { id: 2, name: 'Neu AG' } })
      renderPage()

      await selectCustomer('Muster GmbH')
      await selectCustomer('Neu AG')
      await screen.findByRole('region', { name: 'Rechnung für Neu AG' })
      resolveFirst(preview)

      await waitFor(() => expect(api.previewInvoice).toHaveBeenCalledTimes(2))
      expect(screen.queryByRole('region', { name: 'Rechnung für Muster GmbH' })).not.toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Rechnung für Neu AG' })).toBeInTheDocument()
    })

    test('says it is loading, and goes back to nothing when the customer is cleared', async () => {
      let resolve
      api.previewInvoice.mockImplementation(() => new Promise((r) => { resolve = r }))
      renderPage()

      await selectCustomer('Muster GmbH')
      expect(await screen.findAllByText('Laden...')).not.toHaveLength(0)
      resolve(preview)
      await previewCard()
      await selectCustomer('Wähle einen Kunden')

      await waitFor(() => expect(screen.queryByRole('region', { name: 'Rechnung für Muster GmbH' })).not.toBeInTheDocument())
      expect(screen.getByText('Wähle einen Kunden, um eine Rechnung vorzubereiten.')).toBeInTheDocument()
    })

    test('shows an error with retry-able wording when the preview fails, and keeps the form', async () => {
      api.previewInvoice.mockRejectedValue(new ApiError(500, 'boom'))
      renderPage()

      await selectCustomer('Muster GmbH')

      expect(await screen.findByText('Die Rechnung konnte nicht vorbereitet werden. Bitte versuche es erneut.')).toBeInTheDocument()
      expect(customerSelect()).toHaveValue('1')
      expect(screen.queryByRole('region', { name: 'Rechnung für Muster GmbH' })).not.toBeInTheDocument()
    })

    test('a language switch loads it again in the new language, without a reload of the page', async () => {
      renderPage()
      await selectCustomer('Muster GmbH')
      await previewCard()

      await switchLocale('en')

      await waitFor(() => expect(api.previewInvoice).toHaveBeenLastCalledWith({ ...REQUEST, lang: 'en' }))
      expect(await screen.findByRole('heading', { level: 1, name: 'Invoices' })).toBeInTheDocument()
    })
  })

  describe('the period', () => {
    test.each([
      ['the first day after the last', '2026-03-01', '2026-02-01', 'Der erste Tag darf nicht nach dem letzten Tag liegen.'],
      ['more than 366 days', '2025-01-01', '2026-02-28', 'Der Zeitraum darf höchstens 366 Tage lang sein.'],
      ['a missing first day', '', '2026-02-28', 'Gib den ersten und den letzten Tag des Zeitraums ein.'],
      ['a missing last day', '2026-02-01', '', 'Gib den ersten und den letzten Tag des Zeitraums ein.'],
    ])('%s: shows an error next to the fields, marks them invalid, and asks the backend for nothing', async (_, from, to, message) => {
      renderPage()
      await selectCustomer('Muster GmbH')
      await previewCard()
      api.previewInvoice.mockClear()

      setDay(fromField(), from)
      setDay(toField(), to)

      expect(await screen.findByText(message)).toHaveAttribute('role', 'alert')
      expect(fromField()).toHaveAttribute('aria-invalid', 'true')
      expect(toField()).toHaveAttribute('aria-invalid', 'true')
      expect(fromField()).toHaveAccessibleDescription(message)
      expect(screen.queryByRole('region', { name: 'Rechnung für Muster GmbH' })).not.toBeInTheDocument()
      expect(api.previewInvoice).not.toHaveBeenCalledWith(expect.objectContaining({ from, to }))
    })

    test('366 days are fine, and the error goes away when the period is right again', async () => {
      renderPage()
      await selectCustomer('Muster GmbH')
      await previewCard()

      setDay(fromField(), '2026-03-01')
      await screen.findByText('Der erste Tag darf nicht nach dem letzten Tag liegen.')
      setDay(fromField(), '2025-03-01')

      await waitFor(() => expect(screen.queryByText(/darf nicht nach dem letzten/)).not.toBeInTheDocument())
      expect(fromField()).not.toHaveAttribute('aria-invalid', 'true')
      await waitFor(() => expect(api.previewInvoice).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2025-03-01', to: '2026-02-28' })))
    })

    test('an invoice date that is not a day is refused and asks the backend for nothing', async () => {
      renderPage()
      await selectCustomer('Muster GmbH')
      await previewCard()
      api.previewInvoice.mockClear()

      setDay(dateField(), '')

      expect(await screen.findByText('Gib das Rechnungsdatum ein.')).toBeInTheDocument()
      expect(dateField()).toHaveAttribute('aria-invalid', 'true')
      expect(api.previewInvoice).not.toHaveBeenCalled()
    })
  })

  describe('what is missing', () => {
    const missing = ['senderName', 'senderAddress', 'senderTaxId', 'customerAddress']
    const withMissing = (codes) => api.previewInvoice.mockResolvedValue({ ...preview, missing: codes })

    test('names each missing thing in an alert, with a link to Settings or to the customer', async () => {
      withMissing(missing)
      renderPage()
      await selectCustomer('Muster GmbH')

      const alert = within(await screen.findByRole('alert'))

      expect(alert.getByText('Diese Rechnung kann noch nicht erstellt werden:')).toBeInTheDocument()
      expect(alert.getAllByRole('listitem').map((item) => item.textContent.replace(/\s+/g, ' ').trim())).toEqual([
        'Dein Name fehlt. Einstellungen öffnen', 'Deine Adresse fehlt. Einstellungen öffnen', 'Deine Steuernummer fehlt. Einstellungen öffnen', 'Der Kunde hat keine Adresse. Kunden öffnen',
      ])
      expect(alert.getAllByRole('link', { name: 'Einstellungen öffnen' }).every((link) => link.getAttribute('href') === '/settings')).toBe(true)
      expect(alert.getByRole('link', { name: 'Kunden öffnen' })).toHaveAttribute('href', '/time-tracking/1')
    })

    test('no entries has no link: there is nothing to put right in the settings', async () => {
      withMissing(['noEntries'])
      renderPage()
      await selectCustomer('Muster GmbH')

      const alert = within(await screen.findByRole('alert'))

      expect(alert.getByText('In diesem Zeitraum gibt es keine Einträge zum Abrechnen.')).toBeInTheDocument()
      expect(alert.queryByRole('link')).not.toBeInTheDocument()
    })

    test('creating is not possible: the button is marked disabled, says why, and does not ask', async () => {
      withMissing(['senderTaxId'])
      renderPage()
      await selectCustomer('Muster GmbH')
      await screen.findByRole('alert')

      expect(createButton()).toHaveAttribute('aria-disabled', 'true')
      expect(createButton()).toHaveAccessibleDescription('Ergänze zuerst, was fehlt.')
      await userEvent.click(createButton())

      expect(screen.queryByRole('group', { name: /erstellen\?/ })).not.toBeInTheDocument()
      expect(api.createInvoice).not.toHaveBeenCalled()
    })

    test('an unknown code is left out and does not break the page', async () => {
      withMissing(['somethingNew', 'senderName'])
      renderPage()
      await selectCustomer('Muster GmbH')

      const alert = within(await screen.findByRole('alert'))

      expect(alert.getAllByRole('listitem')).toHaveLength(1)
    })

    test('nothing is missing: no alert, and the button is not disabled', async () => {
      renderPage()
      await selectCustomer('Muster GmbH')
      await previewCard()

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(createButton()).not.toHaveAttribute('aria-disabled', 'true')
    })

    test('a preview without lines (no entries) shows no table', async () => {
      api.previewInvoice.mockResolvedValue({ ...preview, lines: [], net: '0.00', vat: '0.00', gross: '0.00', missing: ['noEntries'] })
      renderPage()
      await selectCustomer('Muster GmbH')

      const card = within(await previewCard())

      expect(card.queryByRole('table')).not.toBeInTheDocument()
    })
  })

  describe('an invoice that already covers the period', () => {
    test('is named in a notice, and creating is still possible', async () => {
      renderPage()
      await selectCustomer('Muster GmbH')
      await previewCard()

      setDay(fromField(), '2026-01-15')
      setDay(toField(), '2026-02-10')

      const notice = await screen.findByText('Bitte prüfen, bevor du sie erstellst: Für diesen Kunden gibt es schon eine Rechnung für diesen Zeitraum.')
      expect(notice.closest('[role="status"]')).toHaveTextContent('Rechnung 2026-0004 umfasst 01.01.2026 bis 31.01.2026.')
      expect(createButton()).not.toHaveAttribute('aria-disabled', 'true')
    })

    test('is not named for a period that does not overlap, or for another customer', async () => {
      api.previewInvoice.mockResolvedValue({ ...preview, customer: { id: 2, name: 'Neu AG' } })
      renderPage()
      await selectCustomer('Neu AG')
      await screen.findByRole('region', { name: 'Rechnung für Neu AG' })
      setDay(fromField(), '2026-01-01')
      setDay(toField(), '2026-01-31')
      await waitFor(() => expect(api.previewInvoice).toHaveBeenLastCalledWith(expect.objectContaining({ customerId: 2, from: '2026-01-01' })))

      expect(screen.queryByText(/schon eine Rechnung/)).not.toBeInTheDocument()
    })

    test('an invoice of a deleted customer is never named for a customer', async () => {
      renderPage()
      await selectCustomer('Muster GmbH')
      await previewCard()

      setDay(fromField(), '2025-12-01')
      setDay(toField(), '2025-12-31')
      await waitFor(() => expect(api.previewInvoice).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2025-12-01' })))

      expect(screen.queryByText(/schon eine Rechnung/)).not.toBeInTheDocument()
    })
  })

  describe('creating', () => {
    const openQuestion = async () => {
      await selectCustomer('Muster GmbH')
      await previewCard()
      await userEvent.click(createButton())
      return screen.findByRole('group', { name: /Rechnung 2026-0007 für Muster GmbH über/ })
    }

    test('asks first, in place, with the number, the customer and the total, and starts on Cancel', async () => {
      renderPage()

      const question = await openQuestion()

      expect(question).toHaveAccessibleName(/^Rechnung 2026-0007 für Muster GmbH über 1\.359,58\s€ erstellen\? Die Nummer ist dann vergeben und die Rechnung lässt sich nicht mehr ändern\.$/)
      expect(within(question).getByRole('button', { name: 'Abbrechen' })).toHaveFocus()
      expect(api.createInvoice).not.toHaveBeenCalled()
    })

    test('Cancel and Escape close the question without creating', async () => {
      renderPage()
      let question = await openQuestion()

      await userEvent.click(within(question).getByRole('button', { name: 'Abbrechen' }))
      expect(screen.queryByRole('group', { name: /erstellen\?/ })).not.toBeInTheDocument()
      await userEvent.click(createButton())
      await screen.findByRole('group', { name: /erstellen\?/ })
      await userEvent.keyboard('{Escape}')

      expect(screen.queryByRole('group', { name: /erstellen\?/ })).not.toBeInTheDocument()
      expect(api.createInvoice).not.toHaveBeenCalled()
      question = null
    })

    test('creates it with the request of the preview', async () => {
      api.createInvoice.mockResolvedValue(created)
      renderPage()
      const question = await openQuestion()

      await userEvent.click(within(question).getByRole('button', { name: 'Rechnung erstellen' }))

      await waitFor(() => expect(api.createInvoice).toHaveBeenCalledTimes(1))
      expect(api.createInvoice).toHaveBeenCalledWith(REQUEST)
    })

    test('creates it with groupByTask when the checkbox is on', async () => {
      api.createInvoice.mockResolvedValue(created)
      renderPage()
      await selectCustomer('Muster GmbH')
      await previewCard()
      await userEvent.click(screen.getByRole('checkbox', { name: 'Stunden je Tag und Aufgabe runden' }))
      await waitFor(() => expect(api.previewInvoice).toHaveBeenLastCalledWith({ ...REQUEST, groupByTask: true }))
      const question = await openQuestion()

      await userEvent.click(within(question).getByRole('button', { name: 'Rechnung erstellen' }))

      await waitFor(() => expect(api.createInvoice).toHaveBeenCalledWith({ ...REQUEST, groupByTask: true }))
    })

    test('switching the checkbox off again asks for the plain preview', async () => {
      renderPage()
      await selectCustomer('Muster GmbH')
      await previewCard()
      const box = screen.getByRole('checkbox', { name: 'Stunden je Tag und Aufgabe runden' })

      await userEvent.click(box)
      await waitFor(() => expect(api.previewInvoice).toHaveBeenLastCalledWith({ ...REQUEST, groupByTask: true }))
      await userEvent.click(box)

      await waitFor(() => expect(api.previewInvoice).toHaveBeenLastCalledWith(REQUEST))
    })

    test('says it was created, shows it in the list, puts the focus on its download button and loads the preview again', async () => {
      api.createInvoice.mockResolvedValue(created)
      api.getInvoices.mockResolvedValueOnce(invoices).mockResolvedValue([{ ...created }, ...invoices])
      renderPage()
      const question = await openQuestion()
      const previewCalls = api.previewInvoice.mock.calls.length

      await userEvent.click(within(question).getByRole('button', { name: 'Rechnung erstellen' }))

      expect(await screen.findByText('Rechnung 2026-0007 erstellt.')).toBeInTheDocument()
      const button = await screen.findByRole('button', { name: 'PDF der Rechnung 2026-0007 herunterladen' })
      await waitFor(() => expect(button).toHaveFocus())
      expect(screen.queryByRole('group', { name: /erstellen\?/ })).not.toBeInTheDocument()
      await waitFor(() => expect(api.previewInvoice.mock.calls.length).toBeGreaterThan(previewCalls))
    })

    test('a second click while it runs creates one invoice only', async () => {
      let resolve
      api.createInvoice.mockImplementation(() => new Promise((r) => { resolve = r }))
      renderPage()
      const question = await openQuestion()

      const confirm = within(question).getByRole('button', { name: 'Rechnung erstellen' })
      await userEvent.click(confirm)
      await userEvent.click(confirm)
      resolve(created)

      await screen.findByText('Rechnung 2026-0007 erstellt.')
      expect(api.createInvoice).toHaveBeenCalledTimes(1)
    })

    test('Escape and Cancel do not close the question while the invoice is being created', async () => {
      let resolve
      api.createInvoice.mockImplementation(() => new Promise((r) => { resolve = r }))
      renderPage()
      const question = await openQuestion()
      await userEvent.click(within(question).getByRole('button', { name: 'Rechnung erstellen' }))

      await userEvent.keyboard('{Escape}')
      await userEvent.click(within(screen.getByRole('group', { name: /erstellen\?/ })).getByRole('button', { name: 'Abbrechen' }))

      expect(screen.getByRole('group', { name: /erstellen\?/ })).toBeInTheDocument()
      resolve(created)
      await screen.findByText('Rechnung 2026-0007 erstellt.')
    })

    test('while it runs, the confirming button is marked disabled', async () => {
      let resolve
      api.createInvoice.mockImplementation(() => new Promise((r) => { resolve = r }))
      renderPage()
      const question = await openQuestion()

      await userEvent.click(within(question).getByRole('button', { name: 'Rechnung erstellen' }))

      expect(within(screen.getByRole('group', { name: /erstellen\?/ })).getByRole('button', { name: 'Rechnung erstellen' })).toHaveAttribute('aria-disabled', 'true')
      resolve(created)
      await screen.findByText('Rechnung 2026-0007 erstellt.')
    })

    test('409: says the number is used, links to the settings, and loads the preview again', async () => {
      api.createInvoice.mockRejectedValue(new ApiError(409, 'The invoice number 2026-0007 is already used'))
      renderPage()
      const question = await openQuestion()
      const previewCalls = api.previewInvoice.mock.calls.length

      await userEvent.click(within(question).getByRole('button', { name: 'Rechnung erstellen' }))

      expect(await screen.findByText('Die Rechnung konnte nicht erstellt werden. Die Rechnungsnummer ist schon vergeben. Erhöhe die nächste Rechnungsnummer in den Einstellungen.')).toHaveAttribute('role', 'alert')
      expect(screen.getByRole('link', { name: 'Einstellungen öffnen' })).toHaveAttribute('href', '/settings')
      await waitFor(() => expect(api.previewInvoice.mock.calls.length).toBeGreaterThan(previewCalls))
      expect(api.getInvoices).toHaveBeenCalledTimes(1)
    })

    test('422: says something is missing, and shows the list of what', async () => {
      api.createInvoice.mockRejectedValue(new ApiError(422, 'Details for the invoice are missing'))
      renderPage()
      const question = await openQuestion()
      api.previewInvoice.mockResolvedValue({ ...preview, missing: ['senderTaxId'] })

      await userEvent.click(within(question).getByRole('button', { name: 'Rechnung erstellen' }))

      expect(await screen.findByText('Die Rechnung konnte nicht erstellt werden. Es fehlt etwas, das die Rechnung braucht. Die Liste oben zeigt, was.')).toBeInTheDocument()
      expect(await screen.findByText('Deine Steuernummer fehlt.')).toBeInTheDocument()
    })

    test('404: says the customer is gone', async () => {
      api.createInvoice.mockRejectedValue(new ApiError(404, 'Customer not found'))
      renderPage()
      const question = await openQuestion()

      await userEvent.click(within(question).getByRole('button', { name: 'Rechnung erstellen' }))

      expect(await screen.findByText('Die Rechnung konnte nicht erstellt werden. Den Kunden gibt es nicht mehr.')).toBeInTheDocument()
    })

    test.each([[500], [0]])('another failure (%i) says to try again, and keeps the form and the preview', async (status) => {
      api.createInvoice.mockRejectedValue(new ApiError(status, 'boom'))
      renderPage()
      const question = await openQuestion()

      await userEvent.click(within(question).getByRole('button', { name: 'Rechnung erstellen' }))

      expect(await screen.findByText(status === 0 ? 'Die Rechnung konnte nicht erstellt werden. Der Server ist nicht erreichbar.' : 'Die Rechnung konnte nicht erstellt werden. Bitte versuche es erneut.')).toBeInTheDocument()
      expect(customerSelect()).toHaveValue('1')
      expect(fromField()).toHaveValue('2026-02-01')
      await previewCard()
      expect(screen.queryByRole('link', { name: 'Einstellungen öffnen' })).not.toBeInTheDocument()
    })

    test('after an error the question can be asked again, and the old error is gone', async () => {
      api.createInvoice.mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValueOnce(created)
      renderPage()
      let question = await openQuestion()
      await userEvent.click(within(question).getByRole('button', { name: 'Rechnung erstellen' }))
      await screen.findByText(/konnte nicht erstellt werden/)
      await previewCard()

      await userEvent.click(createButton())
      question = await screen.findByRole('group', { name: /erstellen\?/ })

      expect(screen.queryByText(/konnte nicht erstellt werden/)).not.toBeInTheDocument()
      await userEvent.click(within(question).getByRole('button', { name: 'Rechnung erstellen' }))
      expect(await screen.findByText('Rechnung 2026-0007 erstellt.')).toBeInTheDocument()
    })

    test('changing the customer or a day closes the question', async () => {
      renderPage()
      await openQuestion()

      setDay(toField(), '2026-02-20')

      await waitFor(() => expect(screen.queryByRole('group', { name: /erstellen\?/ })).not.toBeInTheDocument())
    })
  })

  describe('the list', () => {
    test('shows each invoice with its number, date, customer, period and total, newest first as the backend sorts them', async () => {
      renderPage()

      const table = await screen.findByRole('table', { name: 'Erstellte Rechnungen' })

      const rows = within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').slice(0, 5).map((c) => c.textContent.replace(/\s/g, ' ')))
      expect(rows).toEqual([
        ['2026-0004', '03.02.2026', 'Muster GmbH', '01.01.2026 – 31.01.2026', '500,00 €'],
        ['2026-0003', '05.01.2026', 'Alt AG (gelöscht)', '01.12.2025 – 31.12.2025', '99,90 €'],
      ])
    })

    test('has column headers, and an actions column that is named for screen readers only', async () => {
      renderPage()

      const table = await screen.findByRole('table', { name: 'Erstellte Rechnungen' })

      expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Nummer', 'Datum', 'Kunde', 'Zeitraum', 'Gesamt', 'Aktionen'])
    })

    test('says there are no invoices yet', async () => {
      api.getInvoices.mockResolvedValue([])
      renderPage()

      expect(await screen.findByText('Noch keine Rechnungen.')).toBeInTheDocument()
      expect(screen.queryByRole('table', { name: 'Erstellte Rechnungen' })).not.toBeInTheDocument()
    })

    test('says it is loading', async () => {
      api.getInvoices.mockImplementation(() => new Promise(() => {}))
      renderPage()

      expect(await screen.findByText('Laden...')).toBeInTheDocument()
    })

    test('shows an error with a Try again button that stays, and loads again', async () => {
      api.getInvoices.mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValueOnce(invoices)
      renderPage()

      expect(await screen.findByText('Rechnungen konnten nicht geladen werden. Bitte versuche es erneut.')).toHaveAttribute('role', 'alert')
      await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))

      expect(await screen.findByRole('table', { name: 'Erstellte Rechnungen' })).toBeInTheDocument()
      expect(api.getInvoices).toHaveBeenCalledTimes(2)
    })

    test('the form still works when the list cannot be loaded', async () => {
      api.getInvoices.mockRejectedValue(new ApiError(500, 'boom'))
      renderPage()

      await selectCustomer('Muster GmbH')

      expect(await previewCard()).toBeInTheDocument()
    })
  })

  describe('opening and downloading the PDF', () => {
    test('Open is a link to the stored PDF in a new tab, named with the number', async () => {
      renderPage()

      const link = await screen.findByRole('link', { name: 'PDF der Rechnung 2026-0004 in einem neuen Tab öffnen' })

      expect(link).toHaveAttribute('href', '/api/invoices/4/pdf?inline=1')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      expect(link).toHaveTextContent('Öffnen')
    })

    test('Download loads the stored PDF of that invoice', async () => {
      api.downloadInvoicePdf.mockResolvedValue(null)
      renderPage()

      await userEvent.click(await screen.findByRole('button', { name: 'PDF der Rechnung 2026-0003 herunterladen' }))

      expect(api.downloadInvoicePdf).toHaveBeenCalledWith(3)
    })

    test('a second click while it loads downloads once, and the buttons are marked disabled', async () => {
      let resolve
      api.downloadInvoicePdf.mockImplementation(() => new Promise((r) => { resolve = r }))
      renderPage()
      const button = await screen.findByRole('button', { name: 'PDF der Rechnung 2026-0004 herunterladen' })

      await userEvent.click(button)
      await userEvent.click(button)

      expect(api.downloadInvoicePdf).toHaveBeenCalledTimes(1)
      expect(button).toHaveAttribute('aria-disabled', 'true')
      resolve(null)
      await waitFor(() => expect(button).not.toHaveAttribute('aria-disabled', 'true'))
    })

    test('a failed download shows an error', async () => {
      api.downloadInvoicePdf.mockRejectedValue(new ApiError(404, 'Invoice not found'))
      renderPage()

      await userEvent.click(await screen.findByRole('button', { name: 'PDF der Rechnung 2026-0004 herunterladen' }))

      expect(await screen.findByText('Das PDF konnte nicht heruntergeladen werden. Bitte versuche es erneut.')).toHaveAttribute('role', 'alert')
    })
  })

  describe('deleting', () => {
    const ask = async (number = '2026-0004') => {
      await userEvent.click(await screen.findByRole('button', { name: `Rechnung ${number} löschen` }))
      return screen.findByRole('group', { name: new RegExp(`^Rechnung ${number} löschen\\?`) })
    }

    test('asks in place first, with the warning about the number, and starts on Cancel', async () => {
      renderPage()

      const question = await ask()

      expect(question).toHaveAccessibleName('Rechnung 2026-0004 löschen? Ihre Nummer bleibt vergeben und wird nie wieder verwendet. Eine Rechnung, die du verschickt hast, solltest du aufbewahren.')
      expect(within(question).getByRole('button', { name: 'Abbrechen' })).toHaveFocus()
      expect(api.deleteInvoice).not.toHaveBeenCalled()
    })

    test('Cancel and Escape close the question and delete nothing', async () => {
      renderPage()
      const question = await ask()

      await userEvent.click(within(question).getByRole('button', { name: 'Abbrechen' }))
      expect(screen.queryByRole('group', { name: /löschen\?/ })).not.toBeInTheDocument()
      await ask()
      await userEvent.keyboard('{Escape}')

      expect(screen.queryByRole('group', { name: /löschen\?/ })).not.toBeInTheDocument()
      expect(api.deleteInvoice).not.toHaveBeenCalled()
    })

    test('asks about one invoice at a time', async () => {
      renderPage()
      await ask('2026-0004')

      await userEvent.click(screen.getByRole('button', { name: 'Rechnung 2026-0003 löschen' }))

      expect(await screen.findAllByRole('group', { name: /löschen\?/ })).toHaveLength(1)
      expect(screen.getByRole('group', { name: /Rechnung 2026-0003 löschen\?/ })).toBeInTheDocument()
    })

    test('deletes it, says so, loads the list again and puts the focus on the heading of the list', async () => {
      api.deleteInvoice.mockResolvedValue(null)
      api.getInvoices.mockResolvedValueOnce(invoices).mockResolvedValue([invoices[1]])
      renderPage()
      const question = await ask()

      await userEvent.click(within(question).getByRole('button', { name: 'Löschen' }))

      expect(await screen.findByText('Rechnung 2026-0004 gelöscht.')).toBeInTheDocument()
      expect(api.deleteInvoice).toHaveBeenCalledWith(4)
      await waitFor(() => expect(screen.queryByText('2026-0004')).not.toBeInTheDocument())
      expect(screen.getByRole('heading', { level: 2, name: 'Erstellte Rechnungen' })).toHaveFocus()
    })

    test('the last invoice deleted leaves the empty state', async () => {
      api.deleteInvoice.mockResolvedValue(null)
      api.getInvoices.mockResolvedValueOnce([invoices[0]]).mockResolvedValue([])
      renderPage()
      const question = await ask()

      await userEvent.click(within(question).getByRole('button', { name: 'Löschen' }))

      expect(await screen.findByText('Noch keine Rechnungen.')).toBeInTheDocument()
    })

    test('a failed deletion shows the error in the question and keeps the invoice', async () => {
      api.deleteInvoice.mockRejectedValue(new ApiError(500, 'boom'))
      renderPage()
      const question = await ask()

      await userEvent.click(within(question).getByRole('button', { name: 'Löschen' }))

      expect(await within(screen.getByRole('group', { name: /löschen\?/ })).findByText('Die Rechnung konnte nicht gelöscht werden. Bitte versuche es erneut.')).toHaveAttribute('role', 'alert')
      expect(screen.getByText('2026-0004')).toBeInTheDocument()
      expect(api.getInvoices).toHaveBeenCalledTimes(1)
    })

    test('an old deletion error is gone when another question is asked', async () => {
      api.deleteInvoice.mockRejectedValue(new ApiError(500, 'boom'))
      renderPage()
      const question = await ask()
      await userEvent.click(within(question).getByRole('button', { name: 'Löschen' }))
      await screen.findByText(/konnte nicht gelöscht werden/)

      await userEvent.click(within(screen.getByRole('group', { name: /löschen\?/ })).getByRole('button', { name: 'Abbrechen' }))
      await ask('2026-0003')

      expect(screen.queryByText(/konnte nicht gelöscht werden/)).not.toBeInTheDocument()
    })

    test('deleting an invoice does not touch the preview of the form, which is loaded again', async () => {
      api.deleteInvoice.mockResolvedValue(null)
      renderPage()
      await selectCustomer('Muster GmbH')
      await previewCard()
      const calls = api.previewInvoice.mock.calls.length
      const question = await ask()

      await userEvent.click(within(question).getByRole('button', { name: 'Löschen' }))

      await screen.findByText('Rechnung 2026-0004 gelöscht.')
      await waitFor(() => expect(api.previewInvoice.mock.calls.length).toBeGreaterThan(calls))
    })
  })

  describe('stale state and races', () => {
    test('"Laden..." does not stay when the customer is cleared while the preview is loading', async () => {
      api.previewInvoice.mockImplementation(() => new Promise(() => {}))
      renderPage()
      await selectCustomer('Muster GmbH')
      expect(await screen.findAllByText('Laden...')).not.toHaveLength(0)

      await selectCustomer('Wähle einen Kunden')

      await waitFor(() => expect(screen.queryAllByText('Laden...')).toHaveLength(0))
    })

    test('"Laden..." does not stay when a day is cleared while the preview is loading', async () => {
      api.previewInvoice.mockImplementation(() => new Promise(() => {}))
      renderPage()
      await selectCustomer('Muster GmbH')
      await screen.findAllByText('Laden...')

      setDay(fromField(), '')

      await waitFor(() => expect(screen.queryAllByText('Laden...')).toHaveLength(0))
      expect(screen.getByText('Gib den ersten und den letzten Tag des Zeitraums ein.')).toBeInTheDocument()
    })

    test('a failed creation puts the focus on its error, so it is not lost', async () => {
      api.createInvoice.mockRejectedValue(new ApiError(409, 'used'))
      renderPage()
      await selectCustomer('Muster GmbH')
      await previewCard()
      await userEvent.click(createButton())
      await userEvent.click(within(await screen.findByRole('group', { name: /erstellen\?/ })).getByRole('button', { name: 'Rechnung erstellen' }))

      const message = await screen.findByText(/Die Rechnungsnummer ist schon vergeben/)

      await waitFor(() => expect(message.parentElement).toHaveFocus())
    })

    test('the error of a failed creation is gone when the customer or a day changes', async () => {
      api.createInvoice.mockRejectedValue(new ApiError(409, 'used'))
      renderPage()
      await selectCustomer('Muster GmbH')
      await previewCard()
      await userEvent.click(createButton())
      await userEvent.click(within(await screen.findByRole('group', { name: /erstellen\?/ })).getByRole('button', { name: 'Rechnung erstellen' }))
      await screen.findByText(/Die Rechnungsnummer ist schon vergeben/)
      expect(screen.getByRole('link', { name: 'Einstellungen öffnen' })).toBeInTheDocument()

      await selectCustomer('Neu AG')

      await waitFor(() => expect(screen.queryByText(/Die Rechnungsnummer ist schon vergeben/)).not.toBeInTheDocument())
      expect(screen.queryByRole('link', { name: 'Einstellungen öffnen' })).not.toBeInTheDocument()
    })

    test('right after creating, the invoice that was just made is not named as one that already covers the period', async () => {
      api.createInvoice.mockResolvedValue(created)
      api.getInvoices.mockResolvedValueOnce(invoices).mockResolvedValue([{ ...created, periodFrom: '2026-02-01', periodTo: '2026-02-28' }, ...invoices])
      renderPage()
      await selectCustomer('Muster GmbH')
      await previewCard()
      await userEvent.click(createButton())
      await userEvent.click(within(await screen.findByRole('group', { name: /erstellen\?/ })).getByRole('button', { name: 'Rechnung erstellen' }))
      await screen.findByText('Rechnung 2026-0007 erstellt.')
      await waitFor(() => expect(api.getInvoices.mock.calls.length).toBeGreaterThan(1))
      await previewCard()

      expect(screen.queryByText(/schon eine Rechnung/)).not.toBeInTheDocument()

      setDay(toField(), '2026-02-27')
      await screen.findByText(/schon eine Rechnung/)
    })

    test('a preview that fails late does not put an error on the current choice', async () => {
      let rejectFirst
      api.previewInvoice
        .mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = reject }))
        .mockResolvedValueOnce({ ...preview, customer: { id: 2, name: 'Neu AG' } })
      renderPage()
      await selectCustomer('Muster GmbH')
      await selectCustomer('Neu AG')
      await screen.findByRole('region', { name: 'Rechnung für Neu AG' })

      rejectFirst(new ApiError(500, 'late'))

      await waitFor(() => expect(api.previewInvoice).toHaveBeenCalledTimes(2))
      await new Promise((r) => setTimeout(r, 20))
      expect(screen.queryByText('Die Rechnung konnte nicht vorbereitet werden. Bitte versuche es erneut.')).not.toBeInTheDocument()
    })

    test('the preview error goes away when the customer is cleared', async () => {
      api.previewInvoice.mockRejectedValue(new ApiError(500, 'boom'))
      renderPage()
      await selectCustomer('Muster GmbH')
      await screen.findByText('Die Rechnung konnte nicht vorbereitet werden. Bitte versuche es erneut.')

      await selectCustomer('Wähle einen Kunden')

      expect(screen.queryByText('Die Rechnung konnte nicht vorbereitet werden. Bitte versuche es erneut.')).not.toBeInTheDocument()
    })

    test('an older list answer does not bring back an invoice that was deleted meanwhile', async () => {
      let resolveSlow
      api.createInvoice.mockResolvedValue(created)
      api.deleteInvoice.mockResolvedValue(null)
      api.getInvoices
        .mockResolvedValueOnce(invoices)
        .mockImplementationOnce(() => new Promise((r) => { resolveSlow = r }))
        .mockResolvedValue([invoices[1]])
      renderPage()
      await selectCustomer('Muster GmbH')
      await previewCard()
      await userEvent.click(createButton())
      await userEvent.click(within(await screen.findByRole('group', { name: /erstellen\?/ })).getByRole('button', { name: 'Rechnung erstellen' }))
      await screen.findByText('Rechnung 2026-0007 erstellt.')
      await userEvent.click(screen.getByRole('button', { name: 'Rechnung 2026-0004 löschen' }))
      await userEvent.click(within(await screen.findByRole('group', { name: /löschen\?/ })).getByRole('button', { name: 'Löschen' }))
      await waitFor(() => expect(screen.queryByText('2026-0004')).not.toBeInTheDocument())

      resolveSlow([created, ...invoices])
      await new Promise((r) => setTimeout(r, 20))

      expect(screen.queryByText('2026-0004')).not.toBeInTheDocument()
    })

    test('the preview of a customer that is deleted elsewhere does not stay on the page', async () => {
      const { rerender } = renderPage()
      await selectCustomer('Muster GmbH')
      await previewCard()
      api.previewInvoice.mockRejectedValue(new ApiError(404, 'gone'))

      rerender(<Invoices customers={[customers[1]]} />)

      await waitFor(() => expect(screen.queryByRole('region', { name: 'Rechnung für Muster GmbH' })).not.toBeInTheDocument())
    })

    test('the notice of a created invoice is gone when the next creation fails', async () => {
      api.createInvoice.mockResolvedValueOnce(created).mockRejectedValueOnce(new ApiError(500, 'boom'))
      renderPage()
      const create = async () => {
        await userEvent.click(await screen.findByRole('button', { name: 'Rechnung erstellen' }))
        await userEvent.click(within(await screen.findByRole('group', { name: /erstellen\?/ })).getByRole('button', { name: 'Rechnung erstellen' }))
      }
      await selectCustomer('Muster GmbH')
      await previewCard()
      await create()
      await screen.findByText('Rechnung 2026-0007 erstellt.')
      await create()
      await screen.findByText('Die Rechnung konnte nicht erstellt werden. Bitte versuche es erneut.')

      expect(screen.queryByText('Rechnung 2026-0007 erstellt.')).not.toBeInTheDocument()
    })
  })

  describe('languages and accessibility', () => {
    test('shows the English texts', async () => {
      activateLocale('en')
      renderPage()

      expect(screen.getByRole('heading', { level: 1, name: 'Invoices' })).toBeInTheDocument()
      expect(screen.getByLabelText('From')).toBeInTheDocument()
      expect(screen.getByLabelText('To')).toBeInTheDocument()
      expect(screen.getByLabelText('Invoice date')).toBeInTheDocument()
      await userEvent.selectOptions(screen.getByLabelText('Customer'), 'Muster GmbH')
      expect(await screen.findByRole('region', { name: 'Invoice for Muster GmbH' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create invoice' })).toBeInTheDocument()
      expect(await screen.findByRole('button', { name: 'Delete invoice 2026-0004' })).toBeInTheDocument()
    })

    test.each(['de', 'en'])('has no detectable accessibility violations with a preview, a list and a question in %s', async (locale) => {
      activateLocale(locale)
      const { container } = renderPage()
      await userEvent.selectOptions(screen.getByLabelText(locale === 'de' ? 'Kunde' : 'Customer'), 'Muster GmbH')
      await screen.findByRole('region', { name: locale === 'de' ? 'Rechnung für Muster GmbH' : 'Invoice for Muster GmbH' })
      await userEvent.click(screen.getByRole('button', { name: locale === 'de' ? 'Rechnung erstellen' : 'Create invoice' }))
      await userEvent.click(await screen.findByRole('button', { name: locale === 'de' ? 'Rechnung 2026-0004 löschen' : 'Delete invoice 2026-0004' }))

      expect(await axe(container)).toHaveNoViolations()
    })

    test('has no detectable accessibility violations with missing details, an error and a notice', async () => {
      api.previewInvoice.mockResolvedValue({ ...preview, missing: ['senderName', 'customerAddress', 'noEntries'] })
      const { container } = renderPage()
      await selectCustomer('Muster GmbH')
      await screen.findByRole('alert')
      setDay(fromField(), '2026-03-01')
      await screen.findByText('Der erste Tag darf nicht nach dem letzten Tag liegen.')

      expect(await axe(container)).toHaveNoViolations()
    })
  })
})
