import { useEffect, useId, useRef, useState } from 'react'
import { Trans } from '@lingui/react/macro'
import ErrorMessage from './ErrorMessage'
import { ui } from '../ui'


// A form with visible labels for creating and editing records.
// fields: [{ name, label, type ('text', 'email', 'number', 'date', 'time', 'textarea' or 'select'), required, options, min, step }]
// onSubmit(values) resolves truthy on success; a form without onCancel then resets for the next record.
// With onCancel, the form has a Cancel button and Escape cancels.
// validate(values) returns { field, message } to block submitting, or null.
function RecordForm({ legend, fields, initialValues, submitLabel, onSubmit, onCancel, validate, error, autoFocus }) {
  const id = useId()
  const [values, setValues] = useState(initialValues)
  const [invalid, setInvalid] = useState(null)
  const firstField = useRef(null)

  useEffect(() => {
    if (autoFocus) firstField.current?.focus()
  }, [autoFocus])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const problem = validate?.(values) ?? null
    setInvalid(problem)
    if (problem) return
    if ((await onSubmit(values)) && !onCancel) setValues(initialValues)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && onCancel) {
      e.preventDefault()
      onCancel()
    }
  }

  const errorId = `${id}-error`
  const renderInput = (field, index) => {
    const props = {
      id: `${id}-${field.name}`,
      ref: index === 0 ? firstField : undefined,
      value: values[field.name],
      onChange: (e) => setValues({ ...values, [field.name]: e.target.value }),
      required: field.required,
      'aria-invalid': invalid?.field === field.name || undefined,
      'aria-describedby': invalid?.field === field.name ? errorId : undefined,
      className: ui.input,
    }
    if (field.type === 'textarea') return <textarea {...props} className={`${ui.input} resize-none h-20 py-2`} />
    if (field.type === 'select') {
      return (
        <select {...props}>
          {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      )
    }
    return <input {...props} type={field.type ?? 'text'} min={field.min} step={field.step} />
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="w-full space-y-3">
      <fieldset className="space-y-3">
        {legend && <legend className="mb-1 font-semibold">{legend}</legend>}
        {fields.map((field, index) => (
          <div key={field.name}>
            <label htmlFor={`${id}-${field.name}`} className={ui.label}>{field.label}</label>
            {renderInput(field, index)}
          </div>
        ))}
      </fieldset>

      <div className="flex gap-2">
        <button type="submit" className={`${ui.buttonPrimary} flex-1`}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={ui.buttonSecondary}>
            <Trans>Cancel</Trans>
          </button>
        )}
      </div>

      <ErrorMessage id={errorId} message={invalid?.message ?? error} />
    </form>
  )
}

export default RecordForm
