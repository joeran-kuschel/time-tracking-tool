import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useAction } from './useAction'

// The running timer, loaded from the backend so it survives reloads and page switches.
export function useActiveEntry() {
  const [activeEntry, setActiveEntry] = useState(null)
  const [run, error] = useAction()

  const load = useCallback(async () => {
    const entry = await run(api.getActiveEntry, 'Laufender Timer konnte nicht geladen werden.')
    if (entry !== undefined) setActiveEntry(entry)
  }, [run])

  useEffect(() => {
    load()
  }, [load])

  const start = async (project, description) => {
    const entry = await run(
      () => api.createTimeEntry(project.id, new Date().toISOString(), description),
      'Timer konnte nicht gestartet werden.',
      { 409: 'Es läuft bereits ein Timer.' }
    )
    if (entry) {
      setActiveEntry({ ...entry, project_name: project.name })
      return entry
    }
    // Another tab may have started a timer; show it
    const running = await api.getActiveEntry().catch(() => undefined)
    if (running) setActiveEntry(running)
    return undefined
  }

  const stop = async () => {
    const stopped = await run(
      () => api.stopTimeEntry(activeEntry.id, new Date().toISOString()),
      'Timer konnte nicht gestoppt werden.'
    )
    if (stopped) setActiveEntry(null)
    return stopped
  }

  return { activeEntry, start, stop, error }
}
