import { useCallback, useState } from 'react'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'

const unreachable = msg`The server is not reachable.`
const retry = msg`Please try again.`

// Runs an API call and keeps an error message if it fails.
// run() resolves to the call's result, or undefined when it failed.
// Messages are lazy (msg``) and translated when rendering, so they follow a language switch.
// hintsByStatus replaces the generic hint for specific HTTP statuses.
export function useAction() {
  const { i18n } = useLingui()
  const [failure, setFailure] = useState(null)

  const run = useCallback(async (call, failureMessage, hintsByStatus = {}) => {
    setFailure(null)
    try {
      return await call()
    } catch (err) {
      console.error(failureMessage.message, err)
      const hint = hintsByStatus[err.status] ?? (err.status === 0 ? unreachable : retry)
      setFailure({ message: failureMessage, hint })
      return undefined
    }
  }, [])

  const error = failure && `${i18n._(failure.message)} ${i18n._(failure.hint)}`
  return [run, error]
}
