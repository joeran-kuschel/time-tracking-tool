import { useLingui } from '@lingui/react/macro'
import { formatDay } from '../format'
import SelectCheckbox from './SelectCheckbox'

// The checkbox that selects one finished entry for setting its task (a running entry has none: render nothing).
// selection: useSelection(). Its accessible name tells the entries apart: the project, the day and the task or description.
function EntrySelect({ entry, projectName, selection }) {
  const { t, i18n } = useLingui()
  if (!entry.end_time) return null

  const day = formatDay(i18n, entry.start_time)
  const text = [entry.task, entry.description].filter(Boolean).join(': ')
  const label = text ? t`Select: ${projectName}, ${day}, ${text}` : t`Select: ${projectName}, ${day}`
  return <SelectCheckbox label={label} checked={selection.has(entry.id)} onChange={() => selection.toggle(entry.id)} />
}

export default EntrySelect
