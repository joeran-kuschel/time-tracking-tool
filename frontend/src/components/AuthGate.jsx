import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { api, onSessionEnded } from '../api'
import { useAction } from '../hooks/useAction'
import App from '../App'
import Login from '../pages/Login'
import ErrorMessage from './ErrorMessage'
import { ui } from '../ui'

// Shows the login page until the user is logged in, then the app. Logging out or a session that ends
// removes the app, so none of its data stays in memory.
// user: undefined while the session is being checked, null when nobody is logged in, else { email }
function AuthGate() {
  const [user, setUserState] = useState(undefined)
  const [ended, setEnded] = useState(false)
  // True when the user logged in on the login page; reloading an open session needs no focus move
  const [justLoggedIn, setJustLoggedIn] = useState(false)
  // Whether anybody is logged in right now, for the handler below, which must not show a notice after a logout
  const loggedIn = useRef(false)
  const setUser = (next) => {
    loggedIn.current = Boolean(next)
    setUserState(next)
  }
  const navigate = useNavigate()
  const [run, error] = useAction()
  const [runLogout, logoutError] = useAction()

  const checkSession = useCallback(async () => {
    const session = await run(api.getSession, msg`The login status could not be checked.`)
    if (session !== undefined) setUser(session)
  }, [run])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  useEffect(() => {
    onSessionEnded(() => {
      if (!loggedIn.current) return
      setEnded(true)
      setUser(null)
    })
    return () => onSessionEnded(() => {})
  }, [])

  const logout = async () => {
    if ((await runLogout(api.logout, msg`Logging out failed.`)) !== undefined) {
      setEnded(false)
      setJustLoggedIn(false)
      setUser(null)
      // A deliberate logout starts over at the Dashboard; a session that ends keeps the address for the next login
      navigate('/', { replace: true })
    }
  }

  if (user) return <App onLogout={logout} logoutError={logoutError} focusOnStart={justLoggedIn} />
  if (user === null) {
    return <Login ended={ended} onLogin={(session) => { setEnded(false); setJustLoggedIn(true); setUser(session) }} />
  }
  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <ErrorMessage message={error} />
        <button onClick={checkSession} className={ui.buttonPrimary}><Trans>Try again</Trans></button>
      </div>
    )
  }
  return <div className="flex h-screen items-center justify-center"><Trans>Loading...</Trans></div>
}

export default AuthGate
