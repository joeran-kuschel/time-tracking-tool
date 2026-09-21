import { useEffect, useId, useRef, useState } from 'react'
import { Trans } from '@lingui/react/macro'
import ErrorMessage from './ErrorMessage'

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded text-sm aria-[invalid=true]:border-red-700'

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
      className: inputClass,
    }
    if (field.type === 'textarea') return <textarea {...props} className={`${inputClass} resize-none h-16`} />
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
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-2">
      <fieldset className="space-y-2">
        {legend && <legend className="text-sm font-bold mb-1">{legend}</legend>}
        {fields.map((field, index) => (
          <div key={field.name}>
            <label htmlFor={`${id}-${field.name}`} className="block text-sm font-medium mb-1">{field.label}</label>
            {renderInput(field, index)}
          </div>
        ))}
      </fieldset>

      <div className="flex gap-2">
        <button type="submit" className="flex-1 px-3 py-2 rounded text-sm bg-green-700 text-white hover:bg-green-800">
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-3 py-2 rounded text-sm border border-gray-300 text-gray-700 hover:bg-gray-100">
            <Trans>Cancel</Trans>
          </button>
        )}
      </div>

      <ErrorMessage id={errorId} message={invalid?.message ?? error} />
    </form>
  )
}

export default RecordForm
