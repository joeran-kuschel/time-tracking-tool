import { useState } from 'react'
import { api } from '../api'

function Reports({ customers }) {
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleGenerateReport = async () => {
    if (!selectedCustomer) return

    try {
      setLoading(true)
      const data = await api.getMonthlyReport(selectedCustomer.id, selectedMonth, selectedYear)
      setReport(data)
    } catch (err) {
      console.error('Failed to generate report:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!selectedCustomer) return
    try {
      await api.downloadPDF(selectedCustomer.id, selectedMonth, selectedYear)
    } catch (err) {
      console.error('Failed to download PDF:', err)
    }
  }

  const calculateHours = (startTime, endTime) => {
    if (!endTime) return 0
    const diff = new Date(endTime) - new Date(startTime)
    return (diff / (1000 * 60 * 60)).toFixed(2)
  }

  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ]

  return (
    <div className="space-y-6">
      {/* Report Generator */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold mb-4">Monatsbericht generieren</h2>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Kunde</label>
              <select
                value={selectedCustomer?.id || ''}
                onChange={(e) => {
                  const customer = customers.find(c => c.id === parseInt(e.target.value))
                  setSelectedCustomer(customer)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              >
                <option value="">Wähle einen Kunden</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Monat</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              >
                {monthNames.map((name, i) => (
                  <option key={i} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Jahr</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              >
                {[2024, 2025, 2026, 2027].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleGenerateReport}
              disabled={!selectedCustomer || loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {loading ? 'Wird generiert...' : 'Bericht anzeigen'}
            </button>

            {report && (
              <button
                onClick={handleDownloadPDF}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                PDF herunterladen
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Report Display */}
      {report && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4">
            Abrechnung {selectedCustomer.name} - {monthNames[selectedMonth - 1]} {selectedYear}
          </h3>

          {report.entries.length > 0 ? (
            <>
              <div className="overflow-x-auto mb-6">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left">Datum</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Projekt</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">Stunden</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Beschreibung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.entries.map((entry) => {
                      const hours = calculateHours(entry.start_time, entry.end_time)
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-2">
                            {new Date(entry.start_time).toLocaleDateString('de-DE')}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">{entry.project_name}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">{hours}h</td>
                          <td className="border border-gray-300 px-4 py-2 text-sm">{entry.description || '---'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-50 p-4 rounded border border-gray-300">
                <div className="flex justify-between font-bold">
                  <span>GESAMTSTUNDEN:</span>
                  <span>{report.totalHours}h</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-gray-500">Keine Einträge für diesen Zeitraum</p>
          )}
        </div>
      )}
    </div>
  )
}

export default Reports
