import { useEffect, useId, useRef, useState } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { MAX_TASK } from '../tasks'
import { ui } from '../ui'
import ErrorMessage from './ErrorMessage'

// The question of SetTaskBar: the task for count selected entries, with suggestions. onApply(task) resolves to true when it
// worked; onCancel closes it (also on Escape). The field takes the focus when the form opens; a failed apply keeps what was typed.
function SetTaskForm({ count, suggestions = [], onApply, onCancel, busy = false, error }) {
  const [task, setTask] = useState('')
  const { t } = useLingui()
  const fieldId = useId()
  const listId = useId()
  const field = useRef(null)

  useEffect(() => {
    field.current?.focus()
  }, [])

  const apply = (e) => {
    e.preventDefault()
    return onApply(task)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <form onSubmit={apply} onKeyDown={handleKeyDown} aria-label={t`Set task`} className="flex w-full flex-col gap-3 rounded-lg border border-line-strong bg-paper p-3">
      <div>
        <label htmlFor={fieldId} className={ui.label}><Trans>Task</Trans></label>
        <input
          ref={field}
          id={fieldId}
          type="text"
          list={suggestions.length ? listId : undefined}
          maxLength={MAX_TASK}
          value={task}
          onChange={(e) => setTask(e.target.value)}
          className={ui.input}
        />
        {suggestions.length > 0 && (
          <datalist id={listId}>
            {suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
          </datalist>
        )}
      </div>
      <p className="text-sm text-muted">
        <Plural value={count} one="The task of # entry changes." other="The task of # entries changes." />{' '}
        <Trans>Descriptions, times and projects stay as they are. Leave the field empty to remove the task.</Trans>
      </p>
      <div className="flex gap-2">
        <button type="submit" aria-disabled={busy} className={`${ui.buttonPrimary} aria-disabled:opacity-70`}><Trans>Apply</Trans></button>
        <button type="button" onClick={onCancel} className={ui.buttonSecondary}><Trans>Cancel</Trans></button>
      </div>
      <ErrorMessage message={error} />
    </form>
  )
}

export default SetTaskForm
