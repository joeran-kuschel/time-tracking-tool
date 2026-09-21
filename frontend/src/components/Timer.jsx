import { useState, useEffect } from 'react'
import { api } from '../api'

function Timer({ project, onEntryCreated, onEntryStopped }) {
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [startTime, setStartTime] = useState(null)
  const [currentEntryId, setCurrentEntryId] = useState(null)
  const [description, setDescription] = useState('')

  useEffect(() => {
    let interval
    if (isRunning) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
      }, 100)
    }
    return () => clearInterval(interval)
  }, [isRunning, startTime])

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const handleStart = async () => {
    const now = new Date().toISOString()
    setStartTime(Date.now())
    setElapsedTime(0)

    try {
      const entry = await api.createTimeEntry(project.id, now, description)
      setCurrentEntryId(entry.id)
      setIsRunning(true)
    } catch (err) {
      console.error('Failed to start timer:', err)
    }
  }

  const handleStop = async () => {
    if (!currentEntryId) return

    const endTime = new Date().toISOString()
    setIsRunning(false)

    try {
      await api.stopTimeEntry(currentEntryId, endTime)
      setCurrentEntryId(null)
      setElapsedTime(0)
      setDescription('')
      onEntryStopped()
    } catch (err) {
      console.error('Failed to stop timer:', err)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">{project.name}</h3>

      <div className="text-4xl font-mono text-center p-4 bg-gray-100 rounded">
        {formatTime(elapsedTime)}
      </div>

      <textarea
        placeholder="Beschreibung (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={isRunning}
        className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-none h-20 disabled:bg-gray-100"
      />

      <div className="flex gap-2">
        {!isRunning ? (
          <button
            onClick={handleStart}
            className="flex-1 px-4 py-3 bg-green-500 text-white rounded font-bold hover:bg-green-600"
          >
            Start
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="flex-1 px-4 py-3 bg-red-500 text-white rounded font-bold hover:bg-red-600"
          >
            Stop
          </button>
        )}
      </div>
    </div>
  )
}

export default Timer
