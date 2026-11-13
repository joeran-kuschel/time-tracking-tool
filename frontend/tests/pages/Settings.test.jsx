import { beforeEach, describe, expect, test, vi } from 'vitest'
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
  api: { getSettings: vi.fn(), updateSettings: vi.fn() },
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
        expect(screen.getByRole('button', { name: 'Speichern' })).toHaveFocus()

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
        expect(['checkbox', 'select']).toContain(option.type)
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
