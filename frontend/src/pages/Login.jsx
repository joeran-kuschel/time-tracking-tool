import { ClockIcon } from '@heroicons/react/24/outline'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '../api'
import { useAction } from '../hooks/useAction'
import { usePageTitle } from '../hooks/usePageTitle'
import LanguageSwitcher from '../components/LanguageSwitcher'
import RecordForm from '../components/RecordForm'
import ThemeSwitcher from '../components/ThemeSwitcher'
import { ui } from '../ui'

const wrongCredentials = msg`Check email and password.`
const tooManyAttempts = msg`Too many failed attempts. Try again in a few minutes.`

// The login page. onLogin({ email }) is called after a successful login.
// ended: the session ended while the user was working, which the page says.
function Login({ onLogin, ended }) {
  const { t } = useLingui()
  const [run, error] = useAction()
  usePageTitle(t`Log in`)

  const fields = [
    { name: 'email', label: t`Email`, type: 'email', required: true, autoComplete: 'username' },
    { name: 'password', label: t`Password`, type: 'password', required: true, autoComplete: 'current-password' },
  ]

  const submit = async ({ email, password }) => {
    const user = await run(
      () => api.login(email.trim(), password),
      msg`Login failed.`,
      { 401: wrongCredentials, 429: tooManyAttempts },
    )
    if (user) onLogin(user)
    return user
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-end gap-3 px-4 py-3 sm:px-8">
        <ThemeSwitcher />
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-8 sm:items-center sm:pt-0">
        <div className={`${ui.card} w-full max-w-sm space-y-5`}>
          <p className="flex items-center gap-2.5 text-lg font-semibold">
            <ClockIcon aria-hidden="true" className="h-6 w-6 text-accent" />
            Time Tracking
          </p>
          <h1 className="font-serif text-2xl font-medium"><Trans>Log in</Trans></h1>
          {ended && <p role="status" className="text-sm"><Trans>Your session has ended. Please log in again.</Trans></p>}
          <RecordForm
            fields={fields}
            initialValues={{ email: '', password: '' }}
            submitLabel={t`Log in`}
            onSubmit={submit}
            error={error}
            autoFocus
          />
        </div>
      </main>
    </div>
  )
}

export default Login
