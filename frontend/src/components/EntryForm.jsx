import { useLingui } from '@lingui/react/macro'
import RecordForm from './RecordForm'
import { fromInputs, toDateInput, toTimeInput } from '../entryTime'

const DAY = 24 * 60 * 60 * 1000

// Whole days between the start and end date of an entry, e.g. 1 for a timer that ran past midnight
function daysBetween(start, end) {
  return Math.round((new Date(toDateInput(end)) - new Date(toDateInput(start))) / DAY)
}

// Form to add or edit a finished time entry: project, date, start, end and description.
// The form has one date; an edited entry that ends on a later day keeps that offset.
// onSubmit receives { projectId, startTime, endTime, description } as ISO times.
function EntryForm({ entry, projects, projectId, legend, submitLabel, onSubmit, onCancel, error, autoFocus }) {
  const { t } = useLingui()
  const endDayOffset = entry ? daysBetween(entry.start_time, entry.end_time) : 0

  const initialValues = entry
    ? {
        projectId: String(entry.project_id),
        date: toDateInput(entry.start_time),
        start: toTimeInput(entry.start_time),
        end: toTimeInput(entry.end_time),
        description: entry.description ?? '',
      }
    : { projectId: String(projectId), date: toDateInput(new Date()), start: '', end: '', description: '' }

  const toTimes = (values) => ({
    startTime: fromInputs(values.date, values.start),
    endTime: new Date(new Date(fromInputs(values.date, values.end)).getTime() + endDayOffset * DAY).toISOString(),
  })

  const fields = [
    { name: 'projectId', label: t`Project`, type: 'select', required: true, options: projects.map((p) => ({ value: String(p.id), label: p.name })) },
    { name: 'date', label: t`Date`, type: 'date', required: true },
    { name: 'start', label: t`Start`, type: 'time', required: true },
    { name: 'end', label: endDayOffset > 0 ? t`End (next day)` : t`End`, type: 'time', required: true },
    { name: 'description', label: t`Description (optional)`, type: 'textarea' },
  ]

  const validate = (values) => {
    const { startTime, endTime } = toTimes(values)
    return new Date(endTime) > new Date(startTime) ? null : { field: 'end', message: t`End must be after start.` }
  }

  return (
    <RecordForm
      legend={legend}
      fields={fields}
      initialValues={initialValues}
      submitLabel={submitLabel}
      validate={validate}
      onSubmit={(values) => onSubmit({ projectId: Number(values.projectId), ...toTimes(values), description: values.description })}
      onCancel={onCancel}
      error={error}
      autoFocus={autoFocus}
    />
  )
}

export default EntryForm
