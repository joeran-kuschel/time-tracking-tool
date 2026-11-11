import { useCallback, useState } from 'react'

// A "Try again" button that stays where it is: retrying is true while load() runs, so the button can stay mounted
// (and keep keyboard focus) although the load clears the error that showed it, and a second click is ignored.
export function useRetry(load) {
  const [retrying, setRetrying] = useState(false)

  const retry = useCallback(async () => {
    if (retrying) return
    setRetrying(true)
    await load()
    setRetrying(false)
  }, [load, retrying])

  return [retry, retrying]
}
