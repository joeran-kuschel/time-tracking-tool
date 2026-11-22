import { useEffect, useId, useRef } from 'react'
import { Trans } from '@lingui/react/macro'
import ErrorMessage from './ErrorMessage'
import { ui } from '../ui'

// Asks in place before an action that cannot be undone and is not a deletion (ConfirmDelete is for those), such as creating
// an invoice. Focus starts on Cancel, the safe choice; Escape cancels. confirmLabel is the text of the confirming button;
// busy marks it disabled while the action runs, so a second click does nothing.
function ConfirmAction({ message, confirmLabel, onConfirm, onCancel, busy = false, error }) {
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
    <div role="group" aria-labelledby={id} onKeyDown={handleKeyDown} className="w-full space-y-3 rounded-lg border border-line-strong bg-paper p-3">
      <p id={id} className="text-sm text-ink">{message}</p>
      <div className="flex gap-2">
        <button type="button" onClick={onConfirm} aria-disabled={busy} className={`${ui.buttonPrimary} aria-disabled:opacity-70`}>
          {confirmLabel}
        </button>
        <button type="button" ref={cancelButton} onClick={onCancel} className={ui.buttonSecondary}>
          <Trans>Cancel</Trans>
        </button>
      </div>
      <ErrorMessage message={error} />
    </div>
  )
}

export default ConfirmAction
