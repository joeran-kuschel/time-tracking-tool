import { useState } from 'react'
import { useElapsedTime } from '../hooks/useElapsedTime'
import ErrorMessage from './ErrorMessage'

// Shows the running timer, or a start form for the selected project.
function Timer({ project, activeEntry, onStart, onStop, error }) {
  const [description, setDescription] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const elapsedTime = useElapsedTime(activeEntry?.start_time)

  const isRunning = Boolean(activeEntry)
  const otherProjectSelected = isRunning && project && project.id !== activeEntry.project_id

  const handleStart = async () => {
    if (await onStart(description)) {
      setDescription('')
      setAnnouncement(`Timer gestartet für ${project.name}`)
    }
  }

  const handleStop = async () => {
    if (await onStop()) setAnnouncement('Timer gestoppt')
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">{isRunning ? activeEntry.project_name : project.name}</h3>

      <div className="text-4xl font-mono text-center p-4 bg-gray-100 rounded">
        {elapsedTime}
      </div>

      <div>
        <label htmlFor="timer-description" className="block text-sm font-medium mb-1">
          Beschreibung (optional)
        </label>
        <textarea
          id="timer-description"
          value={isRunning ? activeEntry.description || '' : description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isRunning}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-none h-20 disabled:bg-gray-100"
        />
      </div>

      {otherProjectSelected && (
        <p className="text-sm text-gray-700">
          Der Timer läuft für {activeEntry.project_name}. Stoppe ihn, um {project.name} zu starten.
        </p>
      )}

      <div className="flex gap-2">
        {!isRunning ? (
          <button
            onClick={handleStart}
            className="flex-1 px-4 py-3 bg-green-700 text-white rounded font-bold hover:bg-green-800"
          >
            Start
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="flex-1 px-4 py-3 bg-red-700 text-white rounded font-bold hover:bg-red-800"
          >
            Stop
          </button>
        )}
      </div>

      <ErrorMessage message={error} />
      <p role="status" className="sr-only">{announcement}</p>
    </div>
  )
}

export default Timer
