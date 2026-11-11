import { useCallback, useEffect, useState } from 'react'
import { msg } from '@lingui/core/macro'
import { api } from '../api'
import { useAction } from './useAction'

// The app-wide settings, loaded once from the backend (by App) and shared with the pages, so a saved change applies
// everywhere without a reload. values is null until they are loaded; error is the message of the last failed load
// or save (clear() hides it); save(changes) sends the changed options and resolves to the saved settings, or undefined when it failed.
export function useSettings() {
  const [values, setValues] = useState(null)
  const [run, error, clear] = useAction()

  const load = useCallback(async () => {
    const loaded = await run(api.getSettings, msg`Settings could not be loaded.`)
    if (loaded) setValues(loaded)
  }, [run])

  useEffect(() => {
    load()
  }, [load])

  const save = useCallback(async (changes) => {
    const saved = await run(() => api.updateSettings(changes), msg`Settings could not be saved.`)
    if (saved) setValues(saved)
    return saved
  }, [run])

  return { values, error, clear, load, save }
}
