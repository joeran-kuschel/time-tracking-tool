import { useEffect, useId, useRef } from 'react'
import { Trans } from '@lingui/react/macro'
import ErrorMessage from './ErrorMessage'
import { ui } from '../ui'

// Asks in place before deleting. Focus starts on Cancel, the safe choice; Escape cancels.
function ConfirmDelete({ message, onConfirm, onCancel, error }) {
  const id = useId()
  const cancelButton = useRef(null)

  useEffect(() => {
    cancelButton.current?.focus()
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <div role="group" aria-labelledby={id} onKeyDown={handleKeyDown} className="w-full space-y-3 rounded-lg border border-danger-line bg-danger-soft p-3">
      <p id={id} className="text-sm text-ink">{message}</p>
      <div className="flex gap-2">
        <button type="button" onClick={onConfirm} className={ui.buttonDanger}>
          <Trans>Delete</Trans>
        </button>
        <button type="button" ref={cancelButton} onClick={onCancel} className={ui.buttonSecondary}>
          <Trans>Cancel</Trans>
        </button>
      </div>
      <ErrorMessage message={error} />
    </div>
  )
}

export default ConfirmDelete
