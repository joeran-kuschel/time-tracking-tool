import { useId, useState } from 'react'
import { PlayIcon, StopIcon } from '@heroicons/react/24/solid'
import { Trans, useLingui } from '@lingui/react/macro'
import { useElapsedTime } from '../hooks/useElapsedTime'
import { formatClock } from '../format'
import { ui } from '../ui'
import ErrorMessage from './ErrorMessage'

// Shows the running timer, or a start form for the selected project.
// It stays mounted without a project, and Start and Stop are the same button element,
// so focus survives starting and stopping. The app announces both (useActiveEntry).
// bare: without card and "Timer" heading, for a place that already names it (the dashboard's Timer tab).
function Timer({ project, activeEntry, onStart, onStop, error, bare = false }) {
  const [description, setDescription] = useState('')
  const { t, i18n } = useLingui()
  const headingId = useId()
  const elapsedTime = useElapsedTime(activeEntry?.start_time)

  const isRunning = Boolean(activeEntry)
  const otherProjectSelected = isRunning && project && project.id !== activeEntry.project_id
  const canStart = Boolean(project)

  const handleStart = async () => {
    if (!canStart) return
    if (await onStart(description)) setDescription('')
  }

  const trackedProject = isRunning ? activeEntry.project_name : null
  const selectedProject = project?.name
  const projectName = trackedProject ?? selectedProject
  const since = isRunning ? formatClock(i18n, activeEntry.start_time) : null

  const Wrapper = bare ? 'div' : 'section'
  return (
    <Wrapper
      aria-labelledby={bare ? undefined : headingId}
      className={`${bare ? '' : ui.card} flex flex-col gap-4`}
    >
      {(!bare || isRunning) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {!bare && <h2 id={headingId} className={ui.eyebrow}><Trans>Timer</Trans></h2>}
          {isRunning && (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-danger">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-danger" />
              <Trans>Running since {since}</Trans>
            </p>
          )}
        </div>
      )}

      {projectName && <h3 className="text-lg font-semibold">{projectName}</h3>}

      <div className={`font-mono text-5xl font-medium leading-none tracking-tight ${isRunning ? 'text-ink' : 'text-muted'}`}>
        {elapsedTime}
      </div>

      <div>
        <label htmlFor="timer-description" className={ui.label}>
          <Trans>Description (optional)</Trans>
        </label>
        <input
          id="timer-description"
          type="text"
          value={isRunning ? activeEntry.description || '' : description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isRunning}
          className={`${ui.input} disabled:bg-paper`}
        />
      </div>

      {!isRunning && !canStart && (
        <p id="timer-hint" className="text-sm text-muted"><Trans>Select a project to start the timer.</Trans></p>
      )}

      {otherProjectSelected && (
        <p className="text-sm text-muted">
          <Trans>The timer is running for {trackedProject}. Stop it to start {selectedProject}.</Trans>
        </p>
      )}

      <div className="flex">
        {!isRunning ? (
          <button
            onClick={handleStart}
            aria-disabled={!canStart}
            aria-describedby={canStart ? undefined : 'timer-hint'}
            className={`${canStart ? ui.buttonPrimary : `${ui.buttonSecondary} cursor-not-allowed text-muted`} flex-1 min-h-[3.25rem] text-base`}
          >
            <PlayIcon aria-hidden="true" className="h-4 w-4" />
            <Trans>Start</Trans>
          </button>
        ) : (
          <button onClick={onStop} className={`${ui.buttonDanger} flex-1 min-h-[3.25rem] text-base`}>
            <StopIcon aria-hidden="true" className="h-4 w-4" />
            <Trans>Stop</Trans>
          </button>
        )}
      </div>

      <ErrorMessage message={error} />
    </Wrapper>
  )
}

export default Timer
