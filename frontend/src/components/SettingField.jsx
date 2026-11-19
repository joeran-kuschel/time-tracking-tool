import { useId } from 'react'
import { useLingui } from '@lingui/react/macro'
import { ui } from '../ui'
import { formatDecimal } from '../format'
import ErrorMessage from './ErrorMessage'

// One option of the Settings page (see settingsGroups.js), with a visible label and an optional hint under it.
// value and onChange(value) work with the option's own type: a boolean for a checkbox, the choice's value (a string or
// a number, as the choice has it) for a select. A disabled field shows the option's disabledHint instead of its hint,
// which says why; the field is described by it.
// A 'decimal' option is a text field with a number of the active language ("80,00"): its value is that number (or null
// for empty) until it is edited, and the typed text (a string) after that, which the Settings page reads when saving.
// `error` (a text) is shown under the field and marks it invalid.
function SettingField({ option, value, onChange, disabled = false, error = null }) {
  const { i18n } = useLingui()
  const id = useId()
  const hintText = disabled && option.disabledHint ? option.disabledHint : option.hint
  const hintId = hintText ? `${id}-hint` : undefined
  const hint = hintText && <p id={hintId} className="mt-1 text-sm text-muted">{i18n._(hintText)}</p>

  if (option.type === 'decimal') {
    const text = typeof value === 'string' ? value : value == null ? '' : formatDecimal(i18n, value)
    const errorId = error ? `${id}-error` : undefined
    return (
      <div>
        <label htmlFor={id} className={ui.label}>{i18n._(option.label)}</label>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          className={`${ui.input} disabled:cursor-not-allowed disabled:opacity-60`}
        />
        {hint}
        <ErrorMessage id={errorId} message={error} />
      </div>
    )
  }

  if (option.type === 'checkbox') {
    return (
      <div>
        <label className={`flex min-h-[2.75rem] items-center gap-2 text-sm font-medium ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            aria-describedby={hintId}
            className="h-5 w-5 accent-accent"
          />
          {i18n._(option.label)}
        </label>
        {hint}
      </div>
    )
  }

  return (
    <div>
      <label htmlFor={id} className={ui.label}>{i18n._(option.label)}</label>
      <select
        id={id}
        value={String(value ?? '')}
        disabled={disabled}
        onChange={(e) => onChange(option.choices.find((choice) => String(choice.value) === e.target.value).value)}
        aria-describedby={hintId}
        className={`${ui.select} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {option.choices.map((choice) => <option key={choice.value} value={String(choice.value)}>{i18n._(choice.label)}</option>)}
      </select>
      {hint}
    </div>
  )
}

export default SettingField
