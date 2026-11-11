import { useId } from 'react'
import { useLingui } from '@lingui/react/macro'
import { ui } from '../ui'

// One option of the Settings page (see settingsGroups.js), with a visible label and an optional hint under it.
// value and onChange(value) work with the option's own type: a boolean for a checkbox, the choice's value (a string or
// a number, as the choice has it) for a select. A disabled field shows the option's disabledHint instead of its hint,
// which says why; the field is described by it.
function SettingField({ option, value, onChange, disabled = false }) {
  const { i18n } = useLingui()
  const id = useId()
  const hintText = disabled && option.disabledHint ? option.disabledHint : option.hint
  const hintId = hintText ? `${id}-hint` : undefined
  const hint = hintText && <p id={hintId} className="mt-1 text-sm text-muted">{i18n._(hintText)}</p>

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
