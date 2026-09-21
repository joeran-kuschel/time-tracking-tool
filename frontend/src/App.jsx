import { useState, useEffect } from 'react'
import { api } from './api'
import { useAction } from './hooks/useAction'
import ErrorMessage from './components/ErrorMessage'
import Dashboard from './pages/Dashboard'
import Reports from './pages/Reports'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [run, error] = useAction()

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    setLoading(true)
    const data = await run(api.getCustomers, 'Kunden konnten nicht geladen werden.')
    if (data) setCustomers(data)
    setLoading(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Laden...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Time Tracking</h1>
          <div className="flex gap-4">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`px-4 py-2 rounded ${
                currentPage === 'dashboard'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentPage('reports')}
              className={`px-4 py-2 rounded ${
                currentPage === 'reports'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Berichte
            </button>
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
              Erneut versuchen
            </button>
          </div>
        )}
        {currentPage === 'dashboard' && (
          <Dashboard customers={customers} onCustomersChange={loadCustomers} />
        )}
        {currentPage === 'reports' && (
          <Reports customers={customers} />
        )}
      </main>
    </div>
  )
}

export default App
