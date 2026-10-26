import { useState, useEffect, useRef } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router'
import { ClockIcon } from '@heroicons/react/24/outline'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from './api'
import { useAction } from './hooks/useAction'
import { useActiveEntry } from './hooks/useActiveEntry'
import { useFocusOnPageChange } from './hooks/useFocusOnPageChange'
import { usePageTitle } from './hooks/usePageTitle'
import ErrorMessage from './components/ErrorMessage'
import LanguageSwitcher from './components/LanguageSwitcher'
import RunningTimer from './components/RunningTimer'
import ThemeSwitcher from './components/ThemeSwitcher'
import Dashboard from './pages/Dashboard'
import TimeTracking from './pages/TimeTracking'
import Entries from './pages/Entries'
import Reports from './pages/Reports'
import NotFound from './pages/NotFound'
import { pageFor, pages } from './routes'
import { ui } from './ui'
import './App.css'

function App({ onLogout, logoutError, focusOnStart }) {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [run, error] = useAction()
  const timer = useActiveEntry()
  const main = useRef(null)
  const { t, i18n } = useLingui()
  // The current page: a match of the address (a trailing slash counts, so do the selections after the page), also for the navigation below
  const page = pageFor(useLocation().pathname)

  usePageTitle(page ? i18n._(page.label) : t`Page not found`)
  useFocusOnPageChange(main)

  useEffect(() => {
    loadCustomers()
  }, [])

  // Only the first load shows the loading screen, so reloads keep the page state
  const loadCustomers = async () => {
    const data = await run(api.getCustomers, msg`Customers could not be loaded.`)
    if (data) setCustomers(data)
    setLoading(false)
  }

  // After a login the login form is gone, so focus moves to the page instead of falling back to the top
  useEffect(() => {
    if (focusOnStart && !loading) main.current?.focus()
  }, [focusOnStart, loading])

  // The header's Stop button disappears with the timer, so focus moves to the page
  const stopFromHeader = async () => {
    if (await timer.stop()) main.current?.focus()
  }

  const announcedProject = timer.announcement?.projectName
  const announcementText = !timer.announcement ? ''
    : timer.announcement.kind === 'started' ? t`Timer started for ${announcedProject}` : t`Timer stopped`

  const elements = {
    dashboard: <Dashboard timer={timer} />,
    'time-tracking': <TimeTracking customers={customers} onCustomersChange={loadCustomers} timer={timer} />,
    entries: <Entries customers={customers} />,
    reports: <Reports customers={customers} />,
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><Trans>Loading...</Trans></div>
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="flex min-h-[4rem] flex-wrap items-center gap-x-8 gap-y-2 px-4 py-2 sm:px-8 sm:py-0">
          <p className="flex items-center gap-2.5 text-lg font-semibold">
            <ClockIcon aria-hidden="true" className="h-6 w-6 text-accent" />
            Time Tracking
          </p>
          <nav aria-label={t`Main`} className="flex gap-1 self-stretch">
            {pages.map(({ id, path, label }) => (
              <Link
                key={id}
                to={path}
                aria-current={page?.id === id ? 'page' : undefined}
                className={`inline-flex items-center border-b-[3px] px-3.5 pt-[3px] text-[0.9375rem] ${
                  page?.id === id ? 'border-accent font-semibold text-ink' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {i18n._(label)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-3">
            {timer.activeEntry && <RunningTimer entry={timer.activeEntry} onStop={stopFromHeader} busy={timer.busy} />}
            <ThemeSwitcher />
            <LanguageSwitcher />
            <button onClick={onLogout} className={ui.buttonSecondary}><Trans>Log out</Trans></button>
          </div>
        </div>
      </header>

      <main ref={main} tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
        {logoutError && <div className="mx-4 mt-4 sm:mx-8"><ErrorMessage message={logoutError} /></div>}
        {error && (
          <div className="m-4 flex flex-wrap items-center gap-4 rounded-lg border border-danger-line bg-danger-soft p-4 sm:mx-8">
            <ErrorMessage message={error} />
            <button onClick={loadCustomers} className={ui.buttonPrimary}>
              <Trans>Try again</Trans>
            </button>
          </div>
        )}
        {/* On the Dashboard and the Time tracking page, the timer panel shows the timer's errors */}
        {(page?.id === 'reports' || page?.id === 'entries') && timer.error && (
          <div className="mx-4 mt-4 sm:mx-8"><ErrorMessage message={timer.error} /></div>
        )}
        <Routes>
          {pages.map(({ id, pattern }) => <Route key={id} path={pattern} element={elements[id]} />)}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <p role="status" className="sr-only">{announcementText}</p>
    </div>
  )
}

export default App
