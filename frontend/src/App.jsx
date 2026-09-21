import { useState, useEffect } from 'react'
import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { api } from './api'
import { useAction } from './hooks/useAction'
import { useActiveEntry } from './hooks/useActiveEntry'
import { useElapsedTime } from './hooks/useElapsedTime'
import ErrorMessage from './components/ErrorMessage'
import LanguageSwitcher from './components/LanguageSwitcher'
import Dashboard from './pages/Dashboard'
import Reports from './pages/Reports'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [run, error] = useAction()
  const timer = useActiveEntry()
  const elapsedTime = useElapsedTime(timer.activeEntry?.start_time)
  const runningProject = timer.activeEntry?.project_name

  useEffect(() => {
    loadCustomers()
  }, [])

  // Only the first load shows the loading screen, so reloads keep the page state
  const loadCustomers = async () => {
    const data = await run(api.getCustomers, msg`Customers could not be loaded.`)
    if (data) setCustomers(data)
    setLoading(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><Trans>Loading...</Trans></div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Time Tracking</h1>
          {timer.activeEntry && (
            <p className="text-sm text-gray-700">
              <Trans>Timer running: {runningProject}</Trans> · <span className="font-mono">{elapsedTime}</span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`px-4 py-2 rounded ${
                currentPage === 'dashboard'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Trans>Dashboard</Trans>
            </button>
            <button
              onClick={() => setCurrentPage('reports')}
              className={`px-4 py-2 rounded ${
                currentPage === 'reports'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Trans>Reports</Trans>
            </button>
            <LanguageSwitcher />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4">
        {error && (
          <div className="mb-4 flex flex-wrap items-center gap-4 rounded border border-red-200 bg-red-50 p-4">
            <ErrorMessage message={error} />
            <button
              onClick={loadCustomers}
              className="px-4 py-2 rounded bg-blue-700 text-white hover:bg-blue-800"
            >
              <Trans>Try again</Trans>
            </button>
          </div>
        )}
        {currentPage === 'dashboard' && (
          <Dashboard customers={customers} onCustomersChange={loadCustomers} timer={timer} />
        )}
        {currentPage === 'reports' && (
          <Reports customers={customers} />
        )}
      </main>
    </div>
  )
}

export default App
