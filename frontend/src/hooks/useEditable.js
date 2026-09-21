import { useEffect, useRef, useState } from 'react'
import { useAction } from './useAction'

// State of one record that can be edited in place or deleted after a confirmation.
// Closing the form or confirmation returns focus to the button that opened it.
// messages: { saveFailed, deleteFailed, stopTimerFirst } as msg`` descriptors.
export function useEditable({ onUpdate, onDelete, onDeleted, messages }) {
  const [mode, setMode] = useState('view')
  const [run, error, clearError] = useAction()
  const editButton = useRef(null)
  const deleteButton = useRef(null)
  const returnFocusTo = useRef(null)

  useEffect(() => {
    if (mode === 'view' && returnFocusTo.current) {
      returnFocusTo.current.current?.focus()
      returnFocusTo.current = null
    }
  }, [mode])

  const open = (next) => {
    clearError()
    setMode(next)
  }

  const close = () => {
    returnFocusTo.current = mode === 'edit' ? editButton : deleteButton
    clearError()
    setMode('view')
  }

  const save = async (values) => {
    const saved = await run(() => onUpdate(values), messages.saveFailed, { 409: messages.stopTimerFirst })
    if (saved) close()
    return saved
  }

  const remove = async () => {
    const deleted = await run(onDelete, messages.deleteFailed, { 409: messages.stopTimerFirst })
    if (deleted) onDeleted?.()
    return deleted
  }

  return {
    mode, error, editButton, deleteButton, save, remove,
    startEdit: () => open('edit'),
    startDelete: () => open('delete'),
    cancel: close,
  }
}
