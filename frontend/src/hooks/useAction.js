import { useCallback, useState } from 'react'

// Runs an API call and keeps a German error message if it fails.
// run() resolves to the call's result, or undefined when it failed.
export function useAction() {
  const [error, setError] = useState(null)

  const run = useCallback(async (call, failureMessage) => {
    setError(null)
    try {
      return await call()
    } catch (err) {
      console.error(failureMessage, err)
      const hint = err.status === 0 ? 'Der Server ist nicht erreichbar.' : 'Bitte versuche es erneut.'
      setError(`${failureMessage} ${hint}`)
      return undefined
    }
  }, [])

  return [run, error]
}
