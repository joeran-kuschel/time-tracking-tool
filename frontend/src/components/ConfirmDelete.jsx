import { useEffect, useId, useRef } from 'react'
import { Trans } from '@lingui/react/macro'
import ErrorMessage from './ErrorMessage'

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
    <div role="group" aria-labelledby={id} onKeyDown={handleKeyDown} className="space-y-2 rounded border border-red-200 bg-red-50 p-3">
      <p id={id} className="text-sm text-gray-900">{message}</p>
      <div className="flex gap-2">
        <button type="button" onClick={onConfirm} className="px-3 py-2 rounded text-sm bg-red-700 text-white hover:bg-red-800">
          <Trans>Delete</Trans>
        </button>
        <button type="button" ref={cancelButton} onClick={onCancel} className="px-3 py-2 rounded text-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-100">
          <Trans>Cancel</Trans>
        </button>
      </div>
      <ErrorMessage message={error} />
    </div>
  )
}

export default ConfirmDelete
