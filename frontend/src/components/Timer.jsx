import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useElapsedTime } from '../hooks/useElapsedTime'
import ErrorMessage from './ErrorMessage'

// Shows the running timer, or a start form for the selected project.
// It stays mounted without a project, so focus and announcements survive stopping.
function Timer({ project, activeEntry, onStart, onStop, error }) {
  const [description, setDescription] = useState('')
  // What to announce: { kind: 'started', projectName } or { kind: 'stopped' }
  const [announcement, setAnnouncement] = useState(null)
  const { t } = useLingui()
  const elapsedTime = useElapsedTime(activeEntry?.start_time)

  const isRunning = Boolean(activeEntry)
  const otherProjectSelected = isRunning && project && project.id !== activeEntry.project_id
  const canStart = Boolean(project)

  const handleStart = async () => {
    if (!canStart) return
    if (await onStart(description)) {
      setDescription('')
      setAnnouncement({ kind: 'started', projectName: project.name })
    }
  }

  const handleStop = async () => {
    if (await onStop()) setAnnouncement({ kind: 'stopped' })
  }

  const trackedProject = isRunning ? activeEntry.project_name : null
  const selectedProject = project?.name
  const announcedProject = announcement?.projectName
  const announcementText = !announcement ? ''
    : announcement.kind === 'started' ? t`Timer started for ${announcedProject}` : t`Timer stopped`

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">{trackedProject ?? selectedProject ?? t`Timer`}</h3>

      <div className="text-4xl font-mono text-center p-4 bg-gray-100 rounded">
        {elapsedTime}
      </div>

      <div>
        <label htmlFor="timer-description" className="block text-sm font-medium mb-1">
          <Trans>Description (optional)</Trans>
        </label>
        <textarea
          id="timer-description"
          value={isRunning ? activeEntry.description || '' : description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isRunning}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-none h-20 disabled:bg-gray-100"
        />
      </div>

      {!isRunning && !canStart && (
        <p id="timer-hint" className="text-sm text-gray-700"><Trans>Select a project to start the timer.</Trans></p>
      )}

      {otherProjectSelected && (
        <p className="text-sm text-gray-700">
          <Trans>The timer is running for {trackedProject}. Stop it to start {selectedProject}.</Trans>
        </p>
      )}

      <div className="flex gap-2">
        {!isRunning ? (
          <button
            onClick={handleStart}
            aria-disabled={!canStart}
            aria-describedby={canStart ? undefined : 'timer-hint'}
            className={`flex-1 px-4 py-3 rounded font-bold ${
              canStart ? 'bg-green-700 text-white hover:bg-green-800' : 'bg-gray-200 text-gray-700 cursor-not-allowed'
            }`}
          >
            <Trans>Start</Trans>
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="flex-1 px-4 py-3 bg-red-700 text-white rounded font-bold hover:bg-red-800"
          >
            <Trans>Stop</Trans>
          </button>
        )}
      </div>

      <ErrorMessage message={error} />
      <p role="status" className="sr-only">{announcementText}</p>
    </div>
  )
}

export default Timer
