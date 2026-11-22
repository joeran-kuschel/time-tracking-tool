import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { msg } from '@lingui/core/macro'
import { act, render, screen, within } from '../support/render'
import { axe } from '../support/axe'
import Settings from '@/pages/Settings'
import { settingsGroups } from '@/settingsGroups'
import { useSettings } from '@/hooks/useSettings'
import { api, ApiError } from '@/api'
import { activateLocale } from '@/i18n'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { getSettings: vi.fn(), updateSettings: vi.fn(), getLogo: vi.fn(), putLogo: vi.fn(), deleteLogo: vi.fn() },
}))

// Test groups: there is no real option yet. The texts are English because the catalogs only hold texts of src/
const groups = [
  {
    id: 'billing',
    label: msg`Billing group`,
    options: [
      { name: 'showAmounts', type: 'checkbox', label: msg`Show amounts`, hint: msg`Applies to every report.` },
      {
        name: 'step',
        type: 'select',
        label: msg`Step`,
        choices: [{ value: 'none', label: msg`No rounding` }, { value: '15', label: msg`Quarter hour` }],
      },
    ],
  },
  { id: 'details', label: msg`Details group`, options: [{ name: 'tidy', type: 'checkbox', label: msg`Tidy` }] },
  { id: 'empty', label: msg`Empty group`, options: [] },
]
const initial = { showAmounts: false, step: 'none', tidy: true }

// App's part: loads the settings once and hands them to the page
function Harness({ list = groups }) {
  const settings = useSettings()
  return <Settings settings={settings} groups={list} />
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  api.getSettings.mockResolvedValue(initial)
  api.getLogo.mockRejectedValue(new ApiError(404, 'No logo stored'))
  api.updateSettings.mockImplementation(async (changes) => ({ ...initial, ...changes }))
})

describe('Settings', () => {
  test('has a heading and says there are no options while the list is empty', async () => {
    render(<Harness list={[]} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeInTheDocument()
    expect(screen.getByText('Es gibt noch keine Optionen.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Speichern' })).not.toBeInTheDocument()
  })

  test('shows every group with options as a labelled group of fields, and hides a group without options', async () => {
    render(<Harness />)

    const billing = await screen.findByRole('group', { name: 'Billing group' })
    expect(within(billing).getByRole('checkbox', { name: 'Show amounts' })).not.toBeChecked()
    expect(within(billing).getByRole('combobox', { name: 'Step' })).toHaveValue('none')
    expect(within(screen.getByRole('group', { name: 'Details group' })).getByRole('checkbox', { name: 'Tidy' })).toBeChecked()
    expect(screen.queryByRole('group', { name: 'Empty group' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Speichern' })).toHaveLength(1)
  })

  describe('the real groups', () => {
    test('has the group Time and billing with the amounts option, off by default', async () => {
      api.getSettings.mockResolvedValue({ showAmounts: false })
      render(<Harness list={settingsGroups} />)

      const group = await screen.findByRole('group', { name: 'Zeit und Abrechnung' })
      const box = within(group).getByRole('checkbox', { name: 'Stundensatz und Beträge in Berichten anzeigen' })
      expect(box).not.toBeChecked()
      expect(box).toHaveAccessibleDescription('Die Berichte-Seite startet mit dieser Einstellung. Für einen einzelnen Bericht kannst du sie dort ändern.')
    })

    describe('your details', () => {
      const saved = { showAmounts: false, roundingMinutes: 0, roundingDirection: 'up', showRoundingNote: false, defaultHourlyRate: null, weekStart: 'monday', senderName: null, senderAddress: null, senderEmail: null, senderTaxId: null, vatMode: 'regular', vatRate: 19, invoiceNumberPattern: '{YYYY}-{NNNN}', invoiceNextNumber: 1 }
      const name = () => screen.getByRole('textbox', { name: 'Dein Name oder Firmenname' })
      const address = () => screen.getByRole('textbox', { name: 'Adresse' })
      const email = () => screen.getByRole('textbox', { name: 'E-Mail-Adresse' })
      const save = () => userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

      beforeEach(() => {
        api.getSettings.mockResolvedValue(saved)
        api.updateSettings.mockImplementation(async (changes) => ({ ...saved, ...changes }))
      })

      afterEach(() => activateLocale('de'))

      test('is a group with a name field, a multi-line address and an email field, empty when nothing is set', async () => {
        render(<Harness list={settingsGroups} />)

        const group = await screen.findByRole('group', { name: 'Deine Angaben' })
        expect(within(group).getByRole('textbox', { name: 'Dein Name oder Firmenname' })).toHaveValue('')
        expect(address().tagName).toBe('TEXTAREA')
        expect(address()).toHaveValue('')
        expect(email()).toHaveAttribute('type', 'email')
        expect(email()).toHaveValue('')
      })

      test('names what the browser can fill in (autocomplete) and limits the length of every field', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Deine Angaben' })

        expect([name(), address(), email()].map((field) => field.getAttribute('autocomplete'))).toEqual(['name', 'street-address', 'email'])
        expect([name(), address(), email()].map((field) => field.getAttribute('maxlength'))).toEqual(['100', '300', '254'])
      })

      test('explains where they are printed and describes the address by its hint', async () => {
        render(<Harness list={settingsGroups} />)

        const group = await screen.findByRole('group', { name: 'Deine Angaben' })
        expect(within(group).getByText(/Name, Adresse und E-Mail-Adresse werden oben rechts im PDF-Bericht gedruckt/)).toBeInTheDocument()
        expect(address()).toHaveAccessibleDescription('Bis zu 6 Zeilen, zum Beispiel Straße und Ort.')
      })

      test('shows the saved details, with the lines of the address', async () => {
        api.getSettings.mockResolvedValue({ ...saved, senderName: 'Jana Beispiel', senderAddress: 'Musterweg 1\n12345 Beispielstadt', senderEmail: 'jana@example.test' })
        render(<Harness list={settingsGroups} />)

        await screen.findByRole('group', { name: 'Deine Angaben' })
        expect(name()).toHaveValue('Jana Beispiel')
        expect(address()).toHaveValue('Musterweg 1\n12345 Beispielstadt')
        expect(email()).toHaveValue('jana@example.test')
      })

      test('saves the typed details, trimmed, in one request with the other changes', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Deine Angaben' })

        await userEvent.type(name(), '  Jana Beispiel ')
        await userEvent.type(address(), 'Musterweg 1{Enter}12345 Beispielstadt')
        await userEvent.type(email(), 'jana@example.test')
        await save()

        expect(api.updateSettings).toHaveBeenCalledTimes(1)
        expect(api.updateSettings).toHaveBeenCalledWith({ senderName: 'Jana Beispiel', senderAddress: 'Musterweg 1\n12345 Beispielstadt', senderEmail: 'jana@example.test' })
        expect(await screen.findByText('Einstellungen gespeichert.')).toBeInTheDocument()
      })

      test('removing a detail saves null, and spaces only count as empty', async () => {
        api.getSettings.mockResolvedValue({ ...saved, senderName: 'Jana Beispiel', senderEmail: 'jana@example.test' })
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Deine Angaben' })

        await userEvent.clear(name())
        await userEvent.type(address(), '   ')
        await save()

        expect(api.updateSettings).toHaveBeenCalledWith({ senderName: null })
      })

      test('spaces in an empty field are no change', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Deine Angaben' })

        await userEvent.type(name(), '   ')
        await save()

        expect(api.updateSettings).not.toHaveBeenCalled()
        expect(await screen.findByText('Nichts geändert.')).toBeInTheDocument()
      })

      test.each([['jana'], ['jana@example'], ['jana example@x.de'], ['@x.de']])('refuses the email %j with an error next to the field, the focus on it, and saves nothing', async (value) => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Deine Angaben' })

        await userEvent.type(name(), 'Jana')
        await userEvent.type(email(), value)
        await save()

        expect(await screen.findByText('Gib eine E-Mail-Adresse wie name@beispiel.de ein.')).toBeInTheDocument()
        expect(email()).toHaveAttribute('aria-invalid', 'true')
        expect(email()).toHaveAccessibleDescription(/Gib eine E-Mail-Adresse wie name@beispiel\.de ein\./)
        expect(email()).toHaveFocus()
        expect(api.updateSettings).not.toHaveBeenCalled()
      })

      test('the error goes away when the email is typed again, and the corrected details save', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Deine Angaben' })
        await userEvent.type(email(), 'jana')
        await save()
        await screen.findByText('Gib eine E-Mail-Adresse wie name@beispiel.de ein.')

        await userEvent.type(email(), '@example.test')
        expect(screen.queryByText('Gib eine E-Mail-Adresse wie name@beispiel.de ein.')).not.toBeInTheDocument()
        await save()

        expect(api.updateSettings).toHaveBeenCalledWith({ senderEmail: 'jana@example.test' })
      })

      test('refuses an address with more than 6 lines', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Deine Angaben' })

        await userEvent.type(address(), 'a{Enter}b{Enter}c{Enter}d{Enter}e{Enter}f{Enter}g')
        await save()

        expect(await screen.findByText('Verwende höchstens 6 Zeilen.')).toBeInTheDocument()
        expect(address()).toHaveFocus()
        expect(api.updateSettings).not.toHaveBeenCalled()
      })

      test('turns a pasted tab into a space, so the name is not refused, and keeps the line breaks of the address', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Deine Angaben' })

        await userEvent.click(name())
        await userEvent.paste('Jana\tBeispiel')
        await userEvent.click(address())
        await userEvent.paste('Weg\t1\n12345 Stadt')
        await save()

        expect(api.updateSettings).toHaveBeenCalledWith({ senderName: 'Jana Beispiel', senderAddress: 'Weg 1\n12345 Stadt' })
      })

      test('accepts an address of 6 lines', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Deine Angaben' })

        await userEvent.type(address(), 'a{Enter}b{Enter}c{Enter}d{Enter}e{Enter}f')
        await save()

        expect(api.updateSettings).toHaveBeenCalledWith({ senderAddress: 'a\nb\nc\nd\ne\nf' })
      })

      test('shows the labels and the error in English', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Deine Angaben' })
        act(() => activateLocale('en'))

        expect(screen.getByRole('group', { name: 'Your details' })).toBeInTheDocument()
        await userEvent.type(screen.getByRole('textbox', { name: 'Email address' }), 'jana')
        await userEvent.click(screen.getByRole('button', { name: 'Save' }))
        expect(await screen.findByText('Enter an email address like name@example.com.')).toBeInTheDocument()
      })

      test('has no accessibility violations, also with an error, in German and English', async () => {
        const { container } = render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Deine Angaben' })
        expect(await axe(container)).toHaveNoViolations()

        await userEvent.type(email(), 'jana')
        await save()
        await screen.findByText('Gib eine E-Mail-Adresse wie name@beispiel.de ein.')
        expect(await axe(container)).toHaveNoViolations()

        act(() => activateLocale('en'))
        expect(await axe(container)).toHaveNoViolations()
      })
    })

    describe('invoicing', () => {
      const saved = { showAmounts: false, roundingMinutes: 0, roundingDirection: 'up', showRoundingNote: false, defaultHourlyRate: null, weekStart: 'monday', senderName: null, senderAddress: null, senderEmail: null, senderTaxId: null, vatMode: 'regular', vatRate: 19, invoiceNumberPattern: '{YYYY}-{NNNN}', invoiceNextNumber: 1 }
      const mode = () => screen.getByRole('combobox', { name: 'Umsatzsteuer' })
      const rate = () => screen.getByRole('combobox', { name: 'Umsatzsteuersatz' })
      const pattern = () => screen.getByRole('textbox', { name: 'Muster der Rechnungsnummer' })
      const next = () => screen.getByRole('textbox', { name: 'Nächste Rechnungsnummer' })
      const taxId = () => screen.getByRole('textbox', { name: 'Steuernummer' })
      const save = () => userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
      const year = String(new Date().getUTCFullYear())

      beforeEach(() => {
        api.getSettings.mockResolvedValue(saved)
        api.updateSettings.mockImplementation(async (changes) => ({ ...saved, ...changes }))
      })

      afterEach(() => activateLocale('de'))

      test('is a group with the VAT, the pattern and the next number, and says that nothing else changes', async () => {
        render(<Harness list={settingsGroups} />)

        const group = await screen.findByRole('group', { name: 'Rechnungen' })
        expect(within(group).getByRole('combobox', { name: 'Umsatzsteuer' })).toHaveValue('regular')
        expect(rate()).toHaveValue('19')
        expect(pattern()).toHaveValue('{YYYY}-{NNNN}')
        expect(next()).toHaveValue('1')
        expect(next()).toHaveAttribute('inputmode', 'numeric')
        expect(within(group).getByText(/Sonst ändert sich nichts/)).toBeInTheDocument()
      })

      test('the tax ID is in Your details, one line, up to 30 characters', async () => {
        render(<Harness list={settingsGroups} />)

        const group = await screen.findByRole('group', { name: 'Deine Angaben' })
        expect(within(group).getByRole('textbox', { name: 'Steuernummer' })).toHaveAttribute('maxlength', '30')
        expect(taxId()).toHaveValue('')
      })

      test('saves the tax ID trimmed, and removes it with null', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Deine Angaben' })

        await userEvent.type(taxId(), '  DE123456789 ')
        await save()
        expect(api.updateSettings).toHaveBeenLastCalledWith({ senderTaxId: 'DE123456789' })

        await userEvent.clear(taxId())
        await save()
        expect(api.updateSettings).toHaveBeenLastCalledWith({ senderTaxId: null })
      })

      test('shows the next number live, from the pattern and the number as typed', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Rechnungen' })
        const preview = screen.getByText(/Die nächste Rechnung bekäme die Nummer/).closest('p')
        expect(preview).toHaveTextContent(`Die nächste Rechnung bekäme die Nummer: ${year}-0001`)
        expect(preview).toHaveAttribute('aria-live', 'polite')

        await userEvent.clear(next())
        await userEvent.type(next(), '42')
        expect(preview).toHaveTextContent(`${year}-0042`)

        await userEvent.clear(pattern())
        await userEvent.type(pattern(), 'RE-{{NNN}')
        expect(preview).toHaveTextContent('Die nächste Rechnung bekäme die Nummer: RE-042')
      })

      test('the preview is empty while the pattern or the number cannot be used, but stays in the page', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Rechnungen' })
        const preview = screen.getByText(/Die nächste Rechnung bekäme die Nummer/).closest('p')

        await userEvent.clear(next())
        expect(preview).toBeEmptyDOMElement()
        await userEvent.type(next(), '5')
        await userEvent.clear(pattern())
        expect(preview).toBeEmptyDOMElement()
      })

      test('a small business has no VAT rate to choose: the field is disabled and says why', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Rechnungen' })

        await userEvent.selectOptions(mode(), 'small_business')

        expect(rate()).toBeDisabled()
        expect(rate()).toHaveAccessibleDescription('Kleinunternehmer weisen keine Umsatzsteuer aus.')
        await userEvent.selectOptions(mode(), 'regular')
        expect(rate()).toBeEnabled()
      })

      test('saves the VAT as numbers and strings of the options, and the pattern and number together', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Rechnungen' })

        await userEvent.selectOptions(rate(), '7 %')
        await userEvent.clear(pattern())
        await userEvent.type(pattern(), 'RE-{{YY}-{{NNN}')
        await userEvent.clear(next())
        await userEvent.type(next(), '12')
        await save()

        expect(api.updateSettings).toHaveBeenCalledWith({ vatRate: 7, invoiceNumberPattern: 'RE-{YY}-{NNN}', invoiceNextNumber: 12 })
        expect(await screen.findByText('Einstellungen gespeichert.')).toBeInTheDocument()
      })

      test('describes the pattern field by its hint, which names the placeholders', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Rechnungen' })

        expect(pattern()).toHaveAccessibleDescription(/Platzhalter: \{YYYY\} Jahr, \{YY\} Jahr zweistellig, \{MM\} Monat und ein Zähler wie \{NNNN\}/)
        expect(next()).toHaveAccessibleDescription(/nur erhöht werden/)
      })

      test.each([
        ['{{YYYY}', 'Das Muster braucht genau einen Zähler, zum Beispiel {NNNN}.'],
        ['{{NNNN}{{NN}', 'Das Muster braucht genau einen Zähler, zum Beispiel {NNNN}.'],
        ['#{{NNNN}', 'Verwende außer den Platzhaltern nur Buchstaben, Ziffern und . _ / - sowie Leerzeichen.'],
        ['{{NNNN} ', null],
      ])('refuses the pattern %j with an error next to the field, the focus on it, and saves nothing', async (value, message) => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Rechnungen' })

        await userEvent.clear(pattern())
        await userEvent.type(pattern(), value)
        await save()

        if (message) {
          expect(await screen.findByText(message)).toBeInTheDocument()
          expect(pattern()).toHaveAttribute('aria-invalid', 'true')
          expect(pattern()).toHaveAccessibleDescription(expect.stringContaining(message))
          expect(pattern()).toHaveFocus()
          expect(api.updateSettings).not.toHaveBeenCalled()
        } else {
          // Spaces at the end are trimmed away, so this one is valid
          expect(api.updateSettings).toHaveBeenCalledWith({ invoiceNumberPattern: '{NNNN}' })
        }
      })

      test('an empty pattern is refused, not saved as not set', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Rechnungen' })

        await userEvent.clear(pattern())
        await save()

        expect(await screen.findByText(/Gib ein Muster mit bis zu 40 Zeichen ein/)).toBeInTheDocument()
        expect(api.updateSettings).not.toHaveBeenCalled()
      })

      test.each([[''], ['0'], ['abc'], ['1.5'], ['-3'], ['100000000']])('refuses the next number %j with an error next to the field', async (value) => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Rechnungen' })

        await userEvent.clear(next())
        if (value) await userEvent.type(next(), value)
        await save()

        expect(await screen.findByText('Gib eine ganze Zahl von 1 bis 99.999.999 ein.')).toBeInTheDocument()
        expect(next()).toHaveAttribute('aria-invalid', 'true')
        expect(next()).toHaveFocus()
        expect(api.updateSettings).not.toHaveBeenCalled()
      })

      test('a bad pattern and a bad number show both errors, and nothing of the form is saved, not even a valid change', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Rechnungen' })

        await userEvent.type(taxId(), 'DE123456789')
        await userEvent.clear(pattern())
        await userEvent.type(pattern(), 'RE#{{}NNNN}')
        await userEvent.clear(next())
        await userEvent.type(next(), 'abc')
        await save()

        expect(await screen.findByText('Gib eine ganze Zahl von 1 bis 99.999.999 ein.')).toBeInTheDocument()
        expect(screen.getByText(/Verwende außer den Platzhaltern nur/)).toBeInTheDocument()
        expect(pattern()).toHaveAttribute('aria-invalid', 'true')
        expect(next()).toHaveAttribute('aria-invalid', 'true')
        expect(api.updateSettings).not.toHaveBeenCalled()
      })

      test('a number with leading zeros is read as the number', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Rechnungen' })

        await userEvent.clear(next())
        await userEvent.type(next(), '0007')
        await save()

        expect(api.updateSettings).toHaveBeenCalledWith({ invoiceNextNumber: 7 })
      })

      test('the error goes away when the number is typed again', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Rechnungen' })
        await userEvent.clear(next())
        await save()
        await screen.findByText('Gib eine ganze Zahl von 1 bis 99.999.999 ein.')

        await userEvent.type(next(), '3')

        expect(screen.queryByText('Gib eine ganze Zahl von 1 bis 99.999.999 ein.')).not.toBeInTheDocument()
      })

      test('a refused lowering (409) says that the number can only be raised and keeps what was typed', async () => {
        api.getSettings.mockResolvedValue({ ...saved, invoiceNextNumber: 10 })
        api.updateSettings.mockRejectedValue(new ApiError(409, 'The next invoice number cannot be lowered'))
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Rechnungen' })

        await userEvent.clear(next())
        await userEvent.type(next(), '3')
        await save()

        expect(await screen.findByRole('alert')).toHaveTextContent('Einstellungen konnten nicht gespeichert werden. Die nächste Rechnungsnummer kann nur erhöht, nicht verringert werden.')
        expect(next()).toHaveValue('3')
      })

      test.each(['de', 'en'])('has no detectable accessibility violations in %s', async (locale) => {
        activateLocale(locale)
        const { container } = render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: locale === 'de' ? 'Rechnungen' : 'Invoicing' })

        expect(await axe(container)).toHaveNoViolations()
      })

      test('shows the English texts', async () => {
        activateLocale('en')
        render(<Harness list={settingsGroups} />)

        const group = await screen.findByRole('group', { name: 'Invoicing' })
        expect(within(group).getByRole('combobox', { name: 'VAT' })).toBeInTheDocument()
        expect(within(group).getByRole('textbox', { name: 'Invoice number pattern' })).toBeInTheDocument()
        expect(within(group).getByRole('textbox', { name: 'Next invoice number' })).toBeInTheDocument()
        expect(screen.getByRole('textbox', { name: 'Tax ID' })).toBeInTheDocument()
      })
    })

    describe('first day of the week', () => {
      const saved = { showAmounts: false, roundingMinutes: 0, roundingDirection: 'up', showRoundingNote: false, defaultHourlyRate: null, weekStart: 'monday' }
      const day = () => screen.getByRole('combobox', { name: 'Erster Tag der Woche' })

      beforeEach(() => {
        api.getSettings.mockResolvedValue(saved)
        api.updateSettings.mockImplementation(async (changes) => ({ ...saved, ...changes }))
      })

      test('is a select in the group Kalender, set to the saved day, with a hint', async () => {
        render(<Harness list={settingsGroups} />)

        const group = await screen.findByRole('group', { name: 'Kalender' })
        expect(within(group).getByRole('combobox', { name: 'Erster Tag der Woche' })).toHaveValue('monday')
        expect(within(group).getAllByRole('option').map((option) => option.textContent)).toEqual(['Montag', 'Sonntag'])
        expect(day()).toHaveAccessibleDescription(/Monate und Berichte bleiben Kalendermonate\./)
      })

      test('saves Sunday', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Kalender' })

        await userEvent.selectOptions(day(), 'Sonntag')
        await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

        expect(api.updateSettings).toHaveBeenCalledWith({ weekStart: 'sunday' })
        expect(await screen.findByText('Einstellungen gespeichert.')).toBeInTheDocument()
      })

      test('is Monday when the backend did not send it', async () => {
        api.getSettings.mockResolvedValue({ showAmounts: false })
        render(<Harness list={settingsGroups} />)

        await screen.findByRole('group', { name: 'Kalender' })
        expect(day()).toHaveValue('monday')
      })
    })

    describe('default hourly rate', () => {
      const saved = { showAmounts: false, roundingMinutes: 0, roundingDirection: 'up', showRoundingNote: false, defaultHourlyRate: 80 }
      const rate = () => screen.getByRole('textbox', { name: 'Standard-Stundensatz für neue Projekte (€)' })

      beforeEach(() => {
        api.getSettings.mockResolvedValue(saved)
        api.updateSettings.mockImplementation(async (changes) => ({ ...saved, ...changes }))
      })

      afterEach(() => activateLocale('de'))

      test('shows the saved rate in the language, with a hint that nothing existing changes', async () => {
        render(<Harness list={settingsGroups} />)

        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })
        expect(rate()).toHaveValue('80,00')
        expect(rate()).toHaveAccessibleDescription(/Bestehende Projekte und Berichte ändern sich nicht\./)
      })

      test('is empty when there is no default', async () => {
        api.getSettings.mockResolvedValue({ ...saved, defaultHourlyRate: null })
        render(<Harness list={settingsGroups} />)

        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

        expect(rate()).toHaveValue('')
      })

      test('saves a typed rate as a number', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

        await userEvent.clear(rate())
        await userEvent.type(rate(), '95,5')
        await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

        expect(api.updateSettings).toHaveBeenCalledWith({ defaultHourlyRate: 95.5 })
        expect(await screen.findByText('Einstellungen gespeichert.')).toBeInTheDocument()
        expect(rate()).toHaveValue('95,50')
      })

      test('saves an emptied field as null: no default', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

        await userEvent.clear(rate())
        await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

        expect(api.updateSettings).toHaveBeenCalledWith({ defaultHourlyRate: null })
      })

      test('saves 0 as a rate', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

        await userEvent.clear(rate())
        await userEvent.type(rate(), '0')
        await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

        expect(api.updateSettings).toHaveBeenCalledWith({ defaultHourlyRate: 0 })
      })

      test.each([['abc'], ['-5'], ['80.5'], ['80,555'], ['1.000,00']])('shows an error next to the field and saves nothing for %j', async (text) => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

        await userEvent.clear(rate())
        await userEvent.type(rate(), text)
        await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

        expect(api.updateSettings).not.toHaveBeenCalled()
        expect(rate()).toHaveAttribute('aria-invalid', 'true')
        expect(rate()).toHaveFocus()
        expect(rate()).toHaveAccessibleDescription(/Geben Sie einen Betrag ab 0 mit bis zu zwei Nachkommastellen ein, zum Beispiel 80,00\./)
        expect(screen.queryByText('Einstellungen gespeichert.')).not.toBeInTheDocument()
      })

      test('does not save other changes made together with an invalid rate, and keeps what was typed', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

        await userEvent.click(screen.getByRole('checkbox', { name: 'Stundensatz und Beträge in Berichten anzeigen' }))
        await userEvent.clear(rate())
        await userEvent.type(rate(), 'abc')
        await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

        expect(api.updateSettings).not.toHaveBeenCalled()
        expect(rate()).toHaveValue('abc')
        expect(screen.getByRole('checkbox', { name: 'Stundensatz und Beträge in Berichten anzeigen' })).toBeChecked()
      })

      test('the error goes away when the text is edited, and the corrected rate can be saved', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })
        await userEvent.clear(rate())
        await userEvent.type(rate(), 'abc')
        await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
        expect(rate()).toHaveAttribute('aria-invalid', 'true')

        await userEvent.clear(rate())
        expect(rate()).not.toHaveAttribute('aria-invalid')
        await userEvent.type(rate(), '70')
        await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

        expect(api.updateSettings).toHaveBeenCalledWith({ defaultHourlyRate: 70 })
      })

      test('saves a valid rate together with another change in one request', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

        await userEvent.click(screen.getByRole('checkbox', { name: 'Stundensatz und Beträge in Berichten anzeigen' }))
        await userEvent.clear(rate())
        await userEvent.type(rate(), '70')
        await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

        expect(api.updateSettings).toHaveBeenCalledTimes(1)
        expect(api.updateSettings).toHaveBeenCalledWith({ showAmounts: true, defaultHourlyRate: 70 })
      })

      test('sends only the other change when the rate was typed back to the saved value', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

        await userEvent.click(screen.getByRole('checkbox', { name: 'Stundensatz und Beträge in Berichten anzeigen' }))
        await userEvent.clear(rate())
        await userEvent.type(rate(), '80,00')
        await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

        expect(api.updateSettings).toHaveBeenCalledWith({ showAmounts: true })
      })

      test('keeps the typed rate when the save fails, and saves it with the next try', async () => {
        api.updateSettings.mockRejectedValueOnce(new Error('down'))
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })
        await userEvent.clear(rate())
        await userEvent.type(rate(), '65,5')

        await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
        await screen.findByRole('alert')
        expect(rate()).toHaveValue('65,5')

        await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
        expect(api.updateSettings).toHaveBeenLastCalledWith({ defaultHourlyRate: 65.5 })
      })

      test('moves the focus back to the field when Save is pressed again with the same invalid text', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })
        await userEvent.clear(rate())
        await userEvent.type(rate(), 'abc')
        await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
        expect(rate()).toHaveFocus()

        await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

        expect(rate()).toHaveFocus()
        expect(api.updateSettings).not.toHaveBeenCalled()
      })

      test('typing the saved rate again counts as no change', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

        await userEvent.clear(rate())
        await userEvent.type(rate(), '80')
        await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

        expect(api.updateSettings).not.toHaveBeenCalled()
        expect(await screen.findByText('Nichts geändert.')).toBeInTheDocument()
      })

      test('reads and shows the rate in English format when the language is English', async () => {
        activateLocale('en')
        render(<Harness list={settingsGroups} />)
        const field = await screen.findByRole('textbox', { name: 'Default hourly rate for new projects (€)' })
        expect(field).toHaveValue('80.00')

        await userEvent.clear(field)
        await userEvent.type(field, '95.25')
        await userEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(api.updateSettings).toHaveBeenCalledWith({ defaultHourlyRate: 95.25 })
      })

      test('has no detectable accessibility violations, also with an error', async () => {
        const { container } = render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })
        await userEvent.clear(rate())
        await userEvent.type(rate(), 'abc')
        await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

        expect(await axe(container)).toHaveNoViolations()
      })
    })

    describe('rounding', () => {
      const saved = { showAmounts: false, roundingMinutes: 0, roundingDirection: 'up', showRoundingNote: false }
      const step = () => screen.getByRole('combobox', { name: 'Zeiteinträge runden' })
      const direction = () => screen.getByRole('combobox', { name: 'Richtung' })

      beforeEach(() => {
        api.getSettings.mockResolvedValue(saved)
        api.updateSettings.mockImplementation(async (changes) => ({ ...saved, ...changes }))
      })

      test('offers no rounding and the steps 5, 10, 15, 30 and 60 minutes, and does not round by default', async () => {
        render(<Harness list={settingsGroups} />)

        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })
        expect(within(step()).getAllByRole('option').map((option) => option.textContent)).toEqual([
          'Keine Rundung', '5 Minuten', '10 Minuten', 'Viertelstunde (15 Minuten)', 'Halbe Stunde (30 Minuten)', 'Stunde (60 Minuten)',
        ])
        expect(within(step()).getAllByRole('option').map((option) => option.value)).toEqual(['0', '5', '10', '15', '30', '60'])
        expect(step()).toHaveValue('0')
        expect(within(direction()).getAllByRole('option').map((option) => option.textContent)).toEqual(['Aufrunden', 'Auf- oder abrunden (nächstgelegene Stufe)'])
        expect(direction()).toHaveValue('up')
      })

      test('disables the direction while there is no rounding, and says why', async () => {
        render(<Harness list={settingsGroups} />)

        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

        expect(direction()).toBeDisabled()
        expect(direction()).toHaveAccessibleDescription('Wähle bei "Zeiteinträge runden" eine Stufe, um die Richtung festzulegen.')
      })

      test('enables the direction as soon as a step is chosen, and disables it again for no rounding', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

        await userEvent.selectOptions(step(), 'Viertelstunde (15 Minuten)')
        expect(direction()).toBeEnabled()
        expect(direction()).toHaveAccessibleDescription('')

        await userEvent.selectOptions(direction(), 'Auf- oder abrunden (nächstgelegene Stufe)')
        await userEvent.selectOptions(step(), 'Keine Rundung')
        expect(direction()).toBeDisabled()
        expect(direction()).toHaveValue('nearest')
      })

      describe('the sentence that names the rule', () => {
        const noteBox = () => screen.getByRole('checkbox', { name: 'Rundungsregel in Berichten nennen' })

        test('is off by default, disabled while there is no rounding, and says why', async () => {
          render(<Harness list={settingsGroups} />)

          await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

          expect(noteBox()).not.toBeChecked()
          expect(noteBox()).toBeDisabled()
          expect(noteBox()).toHaveAccessibleDescription('Wähle zuerst bei "Zeiteinträge runden" eine Stufe.')
        })

        test('is enabled with a step, described by what it does, and saved with the step', async () => {
          render(<Harness list={settingsGroups} />)
          await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

          await userEvent.selectOptions(step(), 'Viertelstunde (15 Minuten)')
          expect(noteBox()).toBeEnabled()
          expect(noteBox()).toHaveAccessibleDescription('Fügt der Berichte-Seite und dem PDF einen Satz hinzu, z. B. "Stunden auf Viertelstunden aufgerundet."')

          await userEvent.click(noteBox())
          await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

          expect(api.updateSettings).toHaveBeenCalledWith({ roundingMinutes: 15, showRoundingNote: true })
          expect(await screen.findByText('Einstellungen gespeichert.')).toBeInTheDocument()
        })

        test('keeps its choice while the step is switched back to no rounding, and is disabled again', async () => {
          api.getSettings.mockResolvedValue({ ...saved, roundingMinutes: 15, showRoundingNote: true })
          render(<Harness list={settingsGroups} />)
          await screen.findByRole('group', { name: 'Zeit und Abrechnung' })
          expect(noteBox()).toBeChecked()

          await userEvent.selectOptions(step(), 'Keine Rundung')

          expect(noteBox()).toBeDisabled()
          expect(noteBox()).toBeChecked()
        })

        test('is named in English', async () => {
          activateLocale('en')
          render(<Harness list={settingsGroups} />)

          await screen.findByRole('group', { name: 'Time and billing' })

          expect(screen.getByRole('checkbox', { name: 'Name the rounding rule in reports' })).toBeDisabled()
        })
      })

      test('saves the step as a number and the direction together in one request', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

        await userEvent.selectOptions(step(), 'Halbe Stunde (30 Minuten)')
        await userEvent.selectOptions(direction(), 'Auf- oder abrunden (nächstgelegene Stufe)')
        await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

        expect(api.updateSettings).toHaveBeenCalledTimes(1)
        expect(api.updateSettings).toHaveBeenCalledWith({ roundingMinutes: 30, roundingDirection: 'nearest' })
        expect(await screen.findByText('Einstellungen gespeichert.')).toBeInTheDocument()
        expect(step()).toHaveValue('30')
        expect(direction()).toHaveValue('nearest')
      })

      test.each([['5 Minuten', 5], ['10 Minuten', 10], ['Stunde (60 Minuten)', 60]])('saves the new step %s as the number %s', async (label, minutes) => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

        await userEvent.selectOptions(step(), label)
        expect(direction()).toBeEnabled()
        await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

        expect(api.updateSettings).toHaveBeenCalledWith({ roundingMinutes: minutes })
        expect(await screen.findByText('Einstellungen gespeichert.')).toBeInTheDocument()
        expect(step()).toHaveValue(String(minutes))
      })

      test('names the new steps in English', async () => {
        activateLocale('en')
        render(<Harness list={settingsGroups} />)

        await screen.findByRole('group', { name: 'Time and billing' })

        for (const name of ['5 minutes', '10 minutes', 'Hour (60 minutes)']) {
          expect(screen.getByRole('option', { name })).toBeInTheDocument()
        }
      })

      test('saves only the step when the direction was left alone', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

        await userEvent.selectOptions(step(), 'Viertelstunde (15 Minuten)')
        await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

        expect(api.updateSettings).toHaveBeenCalledWith({ roundingMinutes: 15 })
      })

      test('shows the saved rounding after loading, with the direction enabled', async () => {
        api.getSettings.mockResolvedValue({ ...saved, roundingMinutes: 30, roundingDirection: 'nearest' })
        render(<Harness list={settingsGroups} />)

        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

        expect(step()).toHaveValue('30')
        expect(direction()).toBeEnabled()
        expect(direction()).toHaveValue('nearest')
      })

      test('skips the disabled direction and sentence when tabbing, and reaches them once a step is chosen', async () => {
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

        step().focus()
        await userEvent.tab()
        expect(screen.getByRole('combobox', { name: 'Erster Tag der Woche' })).toHaveFocus()

        await userEvent.selectOptions(step(), 'Halbe Stunde (30 Minuten)')
        step().focus()
        await userEvent.tab()
        expect(direction()).toHaveFocus()
        await userEvent.tab()
        expect(screen.getByRole('checkbox', { name: 'Rundungsregel in Berichten nennen' })).toHaveFocus()
      })

      test('treats a step the backend did not return as no rounding: direction and sentence are disabled', async () => {
        api.getSettings.mockResolvedValue({ showAmounts: false })
        render(<Harness list={settingsGroups} />)
        await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

        expect(direction()).toBeDisabled()
      })

      test('says below the options that the rounding also applies to past months', async () => {
        render(<Harness list={settingsGroups} />)

        const group = await screen.findByRole('group', { name: 'Zeit und Abrechnung' })

        expect(within(group).getByText('Die Rundung gilt auch für Berichte vergangener Monate. PDF- und CSV-Dateien, die du schon heruntergeladen hast, ändern sich nicht.')).toBeInTheDocument()
      })

      test('names the options in English', async () => {
        activateLocale('en')
        render(<Harness list={settingsGroups} />)

        await screen.findByRole('group', { name: 'Time and billing' })

        expect(screen.getByRole('combobox', { name: 'Round time entries' })).toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: 'Direction' })).toBeDisabled()
        expect(screen.getByRole('option', { name: 'Quarter hour (15 minutes)' })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'To the nearest' })).toBeInTheDocument()
      })

      test.each(['de', 'en'])('has no detectable accessibility violations in %s, with the direction disabled and enabled', async (locale) => {
        activateLocale(locale)
        const { container } = render(<Harness list={settingsGroups} />)
        await screen.findByRole('combobox', { name: locale === 'de' ? 'Richtung' : 'Direction' })
        expect(await axe(container)).toHaveNoViolations()

        await userEvent.selectOptions(screen.getByRole('combobox', { name: locale === 'de' ? 'Zeiteinträge runden' : 'Round time entries' }), '15')

        expect(await axe(container)).toHaveNoViolations()
      })
    })

    test('saves the option and names it in English', async () => {
      activateLocale('en')
      api.getSettings.mockResolvedValue({ showAmounts: false })
      api.updateSettings.mockResolvedValue({ showAmounts: true })
      render(<Harness list={settingsGroups} />)

      await userEvent.click(await screen.findByRole('checkbox', { name: 'Show hourly rate and amounts in reports' }))
      await userEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(api.updateSettings).toHaveBeenCalledWith({ showAmounts: true })
      expect(await screen.findByText('Settings saved.')).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Time and billing' })).toBeInTheDocument()
    })

    test.each(['de', 'en'])('has no detectable accessibility violations in %s', async (locale) => {
      activateLocale(locale)
      api.getSettings.mockResolvedValue({ showAmounts: true })
      const { container } = render(<Harness list={settingsGroups} />)
      await screen.findByRole('group', { name: locale === 'de' ? 'Zeit und Abrechnung' : 'Time and billing' })

      expect(await axe(container)).toHaveNoViolations()
    })

    test('every option of the list has a name, a known type and texts, and no name is used twice', () => {
      const options = settingsGroups.flatMap((group) => group.options)

      expect(new Set(options.map((option) => option.name)).size).toBe(options.length)
      expect(new Set(settingsGroups.map((group) => group.id)).size).toBe(settingsGroups.length)
      for (const option of options) {
        expect(['checkbox', 'select', 'decimal', 'integer', 'text', 'textarea', 'email', 'logo']).toContain(option.type)
        expect(option.label).toBeTruthy()
      }
    })
  })

  test('describes a field by its hint', async () => {
    render(<Harness />)

    expect(await screen.findByRole('checkbox', { name: 'Show amounts' })).toHaveAccessibleDescription('Applies to every report.')
  })

  test('saves the changes of several groups in one request and confirms it', async () => {
    render(<Harness />)

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Show amounts' }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Step' }), '15')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tidy' }))
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(api.updateSettings).toHaveBeenCalledTimes(1)
    expect(api.updateSettings).toHaveBeenCalledWith({ showAmounts: true, step: '15', tidy: false })
    expect(await screen.findByText('Einstellungen gespeichert.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Einstellungen gespeichert.')
    expect(screen.getByRole('checkbox', { name: 'Show amounts' })).toBeChecked()
    expect(screen.getByRole('combobox', { name: 'Step' })).toHaveValue('15')
  })

  test('sends only what changed', async () => {
    render(<Harness />)

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Show amounts' }))
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(api.updateSettings).toHaveBeenCalledWith({ showAmounts: true })
  })

  test('sends nothing and says so when nothing changed, also after changing a field back', async () => {
    render(<Harness />)
    const checkbox = await screen.findByRole('checkbox', { name: 'Show amounts' })

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(screen.getByRole('status')).toHaveTextContent('Nichts geändert.')

    await userEvent.click(checkbox)
    await userEvent.click(checkbox)
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(api.updateSettings).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Nichts geändert.')
  })

  test('clears the confirmation when the next change starts', async () => {
    render(<Harness />)

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Show amounts' }))
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByText('Einstellungen gespeichert.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Tidy' }))

    expect(screen.queryByText('Einstellungen gespeichert.')).not.toBeInTheDocument()
  })

  test('shows an error and keeps the input when saving fails, and saves it on the next try', async () => {
    api.updateSettings.mockRejectedValueOnce(new ApiError(500, 'boom'))
    render(<Harness />)

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Show amounts' }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Step' }), '15')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Einstellungen konnten nicht gespeichert werden. Bitte versuche es erneut.')
    expect(screen.getByRole('checkbox', { name: 'Show amounts' })).toBeChecked()
    expect(screen.getByRole('combobox', { name: 'Step' })).toHaveValue('15')
    expect(screen.queryByText('Einstellungen gespeichert.')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(api.updateSettings).toHaveBeenLastCalledWith({ showAmounts: true, step: '15' })
    expect(await screen.findByText('Einstellungen gespeichert.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('says when the server is not reachable', async () => {
    api.updateSettings.mockRejectedValueOnce(new ApiError(0, 'unreachable'))
    render(<Harness />)

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Tidy' }))
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Der Server ist nicht erreichbar.')
  })

  test('shows loading, then an error with a retry when the settings can not be loaded', async () => {
    api.getSettings.mockRejectedValueOnce(new ApiError(500, 'boom'))
    render(<Harness />)

    expect(screen.getByText('Laden...')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Einstellungen konnten nicht geladen werden.')
    expect(screen.queryByRole('button', { name: 'Speichern' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))

    expect(await screen.findByRole('group', { name: 'Billing group' })).toBeInTheDocument()
    expect(api.getSettings).toHaveBeenCalledTimes(2)
  })

  test('describes a field without a hint by nothing', async () => {
    render(<Harness />)

    expect(await screen.findByRole('checkbox', { name: 'Tidy' })).toHaveAccessibleDescription('')
    expect(screen.getByRole('combobox', { name: 'Step' })).toHaveAccessibleDescription('')
  })

  test('keeps the status region in the page, empty until Save is pressed', async () => {
    render(<Harness />)
    await screen.findByRole('group', { name: 'Billing group' })

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  test('shows an option the backend did not return as off and saves its change', async () => {
    api.getSettings.mockResolvedValue({ step: 'none', tidy: true })
    render(<Harness />)

    const checkbox = await screen.findByRole('checkbox', { name: 'Show amounts' })
    expect(checkbox).not.toBeChecked()
    await userEvent.click(checkbox)
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(api.updateSettings).toHaveBeenCalledWith({ showAmounts: true })
  })

  test('sends one request when Save is pressed twice while saving', async () => {
    let finish
    api.updateSettings.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    render(<Harness />)

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Tidy' }))
    const save = screen.getByRole('button', { name: 'Speichern' })
    await userEvent.click(save)
    await userEvent.click(save)
    await act(async () => finish({ ...initial, tidy: false }))

    expect(api.updateSettings).toHaveBeenCalledTimes(1)
  })

  test('shows the saved value of an option named like a prototype key', async () => {
    const list = [{ id: 'g', label: msg`Group`, options: [{ name: 'constructor', type: 'checkbox', label: msg`Odd` }] }]
    api.getSettings.mockResolvedValue({ constructor: true })
    render(<Harness list={list} />)

    expect(await screen.findByRole('checkbox', { name: 'Odd' })).toBeChecked()
  })

  test('keeps focus on the retry button while the settings load again, also when it fails again', async () => {
    api.getSettings.mockRejectedValueOnce(new ApiError(500, 'boom'))
    render(<Harness />)
    await screen.findByRole('alert')
    let resolveLoad
    api.getSettings.mockReturnValueOnce(new Promise((resolve) => { resolveLoad = resolve }))

    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))

    const retry = screen.getByRole('button', { name: 'Erneut versuchen' })
    expect(retry).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Laden...')
    await userEvent.click(retry)
    expect(api.getSettings).toHaveBeenCalledTimes(2)

    await act(async () => resolveLoad(initial))
    expect(await screen.findByRole('group', { name: 'Billing group' })).toBeInTheDocument()
  })

  test('removes the error of a failed save when the next Save finds nothing changed', async () => {
    api.updateSettings.mockRejectedValueOnce(new ApiError(500, 'boom'))
    render(<Harness />)
    const checkbox = await screen.findByRole('checkbox', { name: 'Show amounts' })
    await userEvent.click(checkbox)
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await screen.findByRole('alert')

    await userEvent.click(checkbox)
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Nichts geändert.')
  })

  test('keeps what was typed when the language is switched', async () => {
    render(<Harness />)
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Show amounts' }))

    await act(async () => activateLocale('en'))

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Show amounts' })).toBeChecked()
  })

  test.each(['de', 'en'])('has no detectable accessibility violations in %s, also with an error', async (locale) => {
    activateLocale(locale)
    api.updateSettings.mockRejectedValueOnce(new ApiError(500, 'boom'))
    const { container } = render(<Harness />)
    await screen.findByRole('group', { name: 'Billing group' })
    expect(await axe(container)).toHaveNoViolations()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Tidy' }))
    await userEvent.click(screen.getByRole('button', { name: locale === 'de' ? 'Speichern' : 'Save' }))
    await screen.findByRole('alert')

    expect(await axe(container)).toHaveNoViolations()
  })
})
