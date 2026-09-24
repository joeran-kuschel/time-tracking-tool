import { useCallback, useEffect, useRef, useState } from 'react'
import { msg } from '@lingui/core/macro'
import { api } from '../api'
import { useAction } from './useAction'

// The running timer, loaded from the backend so it survives reloads and page switches.
// announcement tells screen readers what the last start or stop did, wherever it was triggered:
// { kind: 'started', projectName } or { kind: 'stopped' }.
// busy is true while a start or stop is being sent; clicks in that time do nothing, so a double click
// can't start two timers.
export function useActiveEntry() {
  const [activeEntry, setActiveEntry] = useState(null)
  const [announcement, setAnnouncement] = useState(null)
  const [busy, setBusy] = useState(false)
  // The ref sees a second click before React has rendered busy
  const pending = useRef(false)
  const [run, error] = useAction()

  const load = useCallback(async () => {
    const entry = await run(api.getActiveEntry, msg`Running timer could not be loaded.`)
    if (entry !== undefined) setActiveEntry(entry)
  }, [run])

  useEffect(() => {
    load()
  }, [load])

  // Runs one start or stop at a time; resolves to undefined for a click while another one is pending
  const exclusive = async (action) => {
    if (pending.current) return undefined
    pending.current = true
    setBusy(true)
    try {
      return await action()
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  // customer: the project's customer, shown next to the running timer
  const start = (project, description, customer) => exclusive(async () => {
    const entry = await run(
      () => api.createTimeEntry(project.id, new Date().toISOString(), description),
      msg`Timer could not be started.`,
      { 409: msg`A timer is already running.` }
    )
    if (entry) {
      setActiveEntry({ ...entry, project_name: project.name, customer_id: customer?.id, customer_name: customer?.name })
      setAnnouncement({ kind: 'started', projectName: project.name })
      return entry
    }
    // Another tab may have started a timer; show it
    const running = await api.getActiveEntry().catch(() => undefined)
    if (running) setActiveEntry(running)
    return undefined
  })

  const stop = () => exclusive(async () => {
    const stopped = await run(
      () => api.stopTimeEntry(activeEntry.id, new Date().toISOString()),
      msg`Timer could not be stopped.`
    )
    if (stopped) {
      setActiveEntry(null)
      setAnnouncement({ kind: 'stopped' })
    }
    return stopped
  })

  return { activeEntry, announcement, busy, start, stop, error }
}
