import { useState, useEffect, useRef } from 'react'
import { ClockIcon } from '@heroicons/react/24/outline'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from './api'
import { useAction } from './hooks/useAction'
import { useActiveEntry } from './hooks/useActiveEntry'
import ErrorMessage from './components/ErrorMessage'
import LanguageSwitcher from './components/LanguageSwitcher'
import RunningTimer from './components/RunningTimer'
import Dashboard from './pages/Dashboard'
import Reports from './pages/Reports'
import { ui } from './ui'
import './App.css'

const pages = [
  { id: 'dashboard', label: msg`Dashboard` },
  { id: 'reports', label: msg`Reports` },
]

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  // The customer the Reports page opens with, set by "Open report" on the Dashboard
  const [reportCustomerId, setReportCustomerId] = useState(null)
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [run, error] = useAction()
  const timer = useActiveEntry()
  const main = useRef(null)
  const { t, i18n } = useLingui()

  useEffect(() => {
    loadCustomers()
  }, [])

  // Only the first load shows the loading screen, so reloads keep the page state
  const loadCustomers = async () => {
    const data = await run(api.getCustomers, msg`Customers could not be loaded.`)
    if (data) setCustomers(data)
    setLoading(false)
  }

  // The header's Stop button disappears with the timer, so focus moves to the page
  const stopFromHeader = async () => {
    if (await timer.stop()) main.current?.focus()
  }

  const openReport = (customerId) => {
    setReportCustomerId(customerId)
    setCurrentPage('reports')
  }

  const announcedProject = timer.announcement?.projectName
  const announcementText = !timer.announcement ? ''
    : timer.announcement.kind === 'started' ? t`Timer started for ${announcedProject}` : t`Timer stopped`

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
            {pages.map((page) => (
              <button
                key={page.id}
                onClick={() => setCurrentPage(page.id)}
                aria-current={currentPage === page.id ? 'page' : undefined}
                className={`border-b-[3px] px-3.5 pt-[3px] text-[0.9375rem] ${
                  currentPage === page.id ? 'border-accent font-semibold text-ink' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {i18n._(page.label)}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-3">
            {timer.activeEntry && <RunningTimer entry={timer.activeEntry} onStop={stopFromHeader} />}
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main ref={main} tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
        {error && (
          <div className="m-4 flex flex-wrap items-center gap-4 rounded-lg border border-danger-line bg-danger-soft p-4 sm:mx-8">
            <ErrorMessage message={error} />
            <button onClick={loadCustomers} className={ui.buttonPrimary}>
              <Trans>Try again</Trans>
            </button>
          </div>
        )}
        {/* On the Dashboard, the timer panel shows the timer's errors */}
        {currentPage !== 'dashboard' && timer.error && (
          <div className="mx-4 mt-4 sm:mx-8"><ErrorMessage message={timer.error} /></div>
        )}
        {currentPage === 'dashboard' && (
          <Dashboard customers={customers} onCustomersChange={loadCustomers} timer={timer} onOpenReport={openReport} />
        )}
        {currentPage === 'reports' && (
          <Reports customers={customers} initialCustomerId={reportCustomerId} />
        )}
      </main>

      <p role="status" className="sr-only">{announcementText}</p>
    </div>
  )
}

export default App
