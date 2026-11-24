import { useEffect, useRef, useState } from 'react'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { ui } from '../ui'
import SetTaskForm from './SetTaskForm'

// Above a list of entries with checkboxes: what is selected, and the way to set one task for all of it (#121).
// count: the number of selected entries; done: { count } after a task was set (from useBulkTask); suggestions: tasks the
// field offers; onApply(task) resolves to true when it worked; onClear unselects everything; busy: the request is being sent.
// The status line (a polite live region, not a role=status, so the pages keep their one status) is always in the page, so a
// screen reader hears what happened; after a success it takes the focus, since the buttons that had it are gone.
function SetTaskBar({ count, done, suggestions, onApply, onClear, busy = false, error }) {
  const [open, setOpen] = useState(false)
  const { t } = useLingui()
  const status = useRef(null)
  const openButton = useRef(null)
  const wasOpen = useRef(false)
  const changedCount = done?.count

  // Nothing selected (a success, a new search): the question is gone
  useEffect(() => {
    if (count === 0) setOpen(false)
  }, [count])

  useEffect(() => {
    if (done) status.current?.focus()
  }, [done])

  // Closing the question gives the focus back to the button that opened it
  useEffect(() => {
    if (wasOpen.current && !open && count > 0) openButton.current?.focus()
    wasOpen.current = open
  }, [open, count])

  return (
    <div className="flex flex-col gap-3">
      <p ref={status} aria-live="polite" aria-atomic="true" tabIndex={-1} className="text-sm text-muted focus:outline-none">
        {done && count === 0 && <Plural value={changedCount} one="Task changed for # entry." other="Task changed for # entries." />}
      </p>

      {count > 0 && !open && (
        <div role="group" aria-label={t`Selected entries`} className="flex flex-wrap items-center gap-3 rounded-lg border border-line-strong bg-paper px-3 py-2">
          <p className="text-sm font-medium"><Plural value={count} one="# entry selected" other="# entries selected" /></p>
          <button type="button" ref={openButton} onClick={() => setOpen(true)} className={ui.buttonSecondary}><Trans>Set task</Trans></button>
          <button type="button" onClick={onClear} className={ui.buttonSecondary}><Trans>Clear selection</Trans></button>
        </div>
      )}

      {count > 0 && open && (
        <SetTaskForm count={count} suggestions={suggestions} onApply={onApply} onCancel={() => setOpen(false)} busy={busy} error={error} />
      )}
    </div>
  )
}

export default SetTaskBar
