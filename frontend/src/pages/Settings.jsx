import { useEffect, useRef, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useRetry } from '../hooks/useRetry'
import ErrorMessage from '../components/ErrorMessage'
import SettingField from '../components/SettingField'
import { settingsGroups } from '../settingsGroups'
import { formatDecimal, parseDecimal } from '../format'
import { ui } from '../ui'

// App-wide options in groups, saved with one Save button. settings is useSettings() of App; groups is the list of
// settingsGroups.js (a prop for the tests). A group without options is not shown.
// Turns the changes of the form into the values to save: the typed text of a decimal option becomes its number.
// Returns { values: { name: value }, invalid: [name] }, where invalid lists the options whose text is not an amount.
function readChanges(changes, options, i18n) {
  const decimals = options.filter((option) => option.type === 'decimal').map((option) => option.name)
  const values = {}
  const invalid = []
  for (const [name, value] of Object.entries(changes)) {
    const parsed = decimals.includes(name) && typeof value === 'string' ? parseDecimal(i18n, value) : value
    if (parsed === undefined) invalid.push(name)
    else values[name] = parsed
  }
  return { values, invalid }
}

// The page keeps only what was changed (`changes`) and shows it over the saved values; a failed save keeps it.
// A 'decimal' option is kept as the typed text until Save, which reads it in the format of the active language; text
// that is not a valid amount is reported next to the field (`fieldErrors`) and nothing is saved.
function Settings({ settings, groups = settingsGroups }) {
  const { i18n, t } = useLingui()
  const form = useRef(null)
  // Set by a refused save: only then the first invalid field gets the focus, not when its text is edited later
  const focusInvalid = useRef(false)
  const [changes, setChanges] = useState({})
  const [fieldErrors, setFieldErrors] = useState({})
  // What the live region says after pressing Save; cleared by the next change
  const [saved, setSaved] = useState(null)
  const [retry, retrying] = useRetry(settings.load)
  // A second press before the first save has answered would send the same changes again
  const saving = useRef(false)
  const shown = groups.filter((group) => group.options.length > 0)
  // What the form shows: the saved values with the changes over them
  const current = settings.values ? { ...settings.values, ...changes } : {}

  // After a refused save, the first invalid field gets the focus, so keyboard and screen reader users land on the error
  useEffect(() => {
    if (!focusInvalid.current) return
    focusInvalid.current = false
    form.current?.querySelector('[aria-invalid="true"]')?.focus()
  }, [fieldErrors])

  const change = (name, value) => {
    setSaved(null)
    setChanges((current) => ({ ...current, [name]: value }))
    setFieldErrors(({ [name]: _removed, ...rest }) => rest)
  }

  const save = async (e) => {
    e.preventDefault()
    const { values, invalid } = readChanges(changes, shown.flatMap((group) => group.options), i18n)
    if (invalid.length > 0) {
      const message = t`Enter an amount from 0 with up to two decimals, for example ${formatDecimal(i18n, 80)}.`
      setSaved(null)
      focusInvalid.current = true
      setFieldErrors(Object.fromEntries(invalid.map((name) => [name, message])))
      return
    }
    setFieldErrors({})
    // Back to the saved value counts as no change
    const changed = Object.fromEntries(Object.entries(values).filter(([name, value]) => value !== settings.values[name]))
    if (Object.keys(changed).length === 0) {
      settings.clear() // an old error of a failed save does not belong to this answer
      setChanges({})
      setSaved('unchanged')
      return
    }
    if (saving.current) return
    saving.current = true
    try {
      if (await settings.save(changed)) {
        setChanges({})
        setSaved('saved')
      }
    } finally {
      saving.current = false
    }
  }

  let body
  if (shown.length === 0) {
    body = <p className="text-muted"><Trans>There are no options yet.</Trans></p>
  } else if (!settings.values) {
    body = settings.error || retrying
      ? (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-danger-line bg-danger-soft p-4">
          {settings.error ? <ErrorMessage message={settings.error} /> : <p role="status"><Trans>Loading...</Trans></p>}
          <button type="button" onClick={retry} aria-disabled={retrying} className={`${ui.buttonPrimary} aria-disabled:opacity-70`}>
            <Trans>Try again</Trans>
          </button>
        </div>
      )
      : <p role="status" className="text-muted"><Trans>Loading...</Trans></p>
  } else {
    body = (
      <form ref={form} onSubmit={save} noValidate className="flex max-w-2xl flex-col gap-6">
        {shown.map((group) => (
          <div key={group.id} className={ui.card}>
            <fieldset className="min-w-0 space-y-4">
              <legend className="mb-3 text-lg font-semibold">{i18n._(group.label)}</legend>
              {group.options.map((option) => (
                <SettingField
                  key={option.name}
                  option={option}
                  value={current[option.name]}
                  disabled={option.disabledWhen?.(current) ?? false}
                  error={fieldErrors[option.name]}
                  onChange={(value) => change(option.name, value)}
                />
              ))}
              {group.note && <p className="text-sm text-muted">{i18n._(group.note)}</p>}
            </fieldset>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" className={ui.buttonPrimary}><Trans>Save</Trans></button>
          <p role="status" className="text-sm">
            {saved === 'saved' && <Trans>Settings saved.</Trans>}
            {saved === 'unchanged' && <Trans>Nothing has changed.</Trans>}
          </p>
        </div>
        <ErrorMessage message={settings.error} />
      </form>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-8">
      <h1 className="font-serif text-4xl font-semibold leading-tight"><Trans>Settings</Trans></h1>
      {body}
    </div>
  )
}

export default Settings
