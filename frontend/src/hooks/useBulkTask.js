import { useEffect, useRef, useState } from 'react'
import { msg } from '@lingui/core/macro'
import { api } from '../api'
import { useAction } from './useAction'
import { useSelection } from './useSelection'

const hints = {
  404: msg`An entry does not exist any more. Reload the list and select again.`,
  409: msg`A timer is running for one of the entries. Stop it first.`,
}

// Setting the task of the selected entries (#121): the selection, the request, its error and what the status line says.
// onDone runs after the task was set, so the page can reload its entries. apply(task) resolves to true on success, and then the
// selection is empty and done is { count } (a new object each time).
export function useBulkTask(onDone) {
  const selection = useSelection()
  const [run, error, clearError] = useAction()
  const [done, setDone] = useState(null)
  const [busy, setBusy] = useState(false)
  // The ref sees a second click before React has rendered busy
  const pending = useRef(false)

  // A new selection starts: the message about the last change is over, and does not come back when it is cleared
  const selectedCount = selection.count
  useEffect(() => {
    if (selectedCount > 0) setDone(null)
  }, [selectedCount])

  const apply = async (task) => {
    if (pending.current) return false
    pending.current = true
    setBusy(true)
    const result = await run(() => api.setTask(selection.ids, task), msg`The task could not be set.`, hints)
    pending.current = false
    setBusy(false)
    if (!result) return false
    selection.clear()
    setDone({ count: result.updated })
    await onDone?.()
    return true
  }

  return { selection, apply, busy, error, clearError, done }
}
