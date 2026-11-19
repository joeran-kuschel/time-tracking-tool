import { PlayIcon } from '@heroicons/react/24/outline'
import { Trans, useLingui } from '@lingui/react/macro'
import { ui } from '../ui'

// The two descriptions of the Resume buttons. A list renders ResumeHints once (not per row); the ids are fixed, so
// a page has one list with Resume buttons.
const RUNNING_HINT_ID = 'resume-hint-running'
const BREAK_HINT_ID = 'resume-hint-break'

export function ResumeHints() {
  return (
    <>
      <p id={RUNNING_HINT_ID} className="sr-only"><Trans>Stop the running timer first.</Trans></p>
      <p id={BREAK_HINT_ID} className="sr-only"><Trans>The entry runs on: the time since its end counts as work time.</Trans></p>
    </>
  )
}

// Runs a finished entry on again, wherever entries are listed (Time tracking, Dashboard, Entries).
// resume: { onResume(entry), timerRunning, busy }; without it, and for a running entry, there is no button.
// timerRunning: a timer runs, so the button is disabled and says why; busy: a start or stop is being sent.
// The title is the accessible name: the project and, when the entry has one, its description.
function ResumeButton({ entry, projectName, resume }) {
  const { t } = useLingui()
  if (!resume || !entry.end_time) return null

  const { description } = entry
  const label = description ? t`Resume: ${projectName}, ${description}` : t`Resume: ${projectName}`
  const blocked = resume.timerRunning || resume.busy

  return (
    <button type="button" onClick={() => !blocked && resume.onResume(entry)} title={label}
      aria-disabled={blocked} aria-describedby={resume.timerRunning ? RUNNING_HINT_ID : BREAK_HINT_ID}
      className={`${ui.iconButton} shrink-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}>
      <PlayIcon aria-hidden="true" className="h-5 w-5" />
    </button>
  )
}

export default ResumeButton
