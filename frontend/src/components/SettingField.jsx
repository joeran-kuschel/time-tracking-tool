import { useId } from 'react'
import { useLingui } from '@lingui/react/macro'
import { ui } from '../ui'

// One option of the Settings page (see settingsGroups.js), with a visible label and an optional hint under it.
// value and onChange(value) work with the option's own type: a boolean for a checkbox, the choice's value for a select.
function SettingField({ option, value, onChange }) {
  const { i18n } = useLingui()
  const id = useId()
  const hintId = option.hint ? `${id}-hint` : undefined
  const hint = option.hint && <p id={hintId} className="mt-1 text-sm text-muted">{i18n._(option.hint)}</p>

  if (option.type === 'checkbox') {
    return (
      <div>
        <label className="flex min-h-[2.75rem] items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={Boolean(value)}
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
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} aria-describedby={hintId} className={ui.select}>
        {option.choices.map((choice) => <option key={choice.value} value={choice.value}>{i18n._(choice.label)}</option>)}
      </select>
      {hint}
    </div>
  )
}

export default SettingField
