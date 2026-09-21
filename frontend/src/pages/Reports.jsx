import { useState } from 'react'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '../api'
import { useAction } from '../hooks/useAction'
import ErrorMessage from '../components/ErrorMessage'
import { formatHours, hoursBetween } from '../format'

function Reports({ customers }) {
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [run, error] = useAction()
  const { t, i18n } = useLingui()

  const handleGenerateReport = async () => {
    if (!selectedCustomer) return

    setLoading(true)
    const data = await run(
      () => api.getMonthlyReport(selectedCustomer.id, selectedMonth, selectedYear),
      msg`Report could not be loaded.`
    )
    if (data) setReport(data)
    setLoading(false)
  }

  const handleDownloadPDF = async () => {
    if (!selectedCustomer) return
    try {
      await api.downloadPDF(selectedCustomer.id, selectedMonth, selectedYear, i18n.locale)
    } catch (err) {
      console.error('Failed to download PDF:', err)
    }
  }

  const monthNames = Array.from({ length: 12 }, (_, i) => i18n.date(new Date(2000, i, 1), { month: 'long' }))
  const reportCustomer = selectedCustomer?.name
  const reportPeriod = i18n.date(new Date(selectedYear, selectedMonth - 1, 1), { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Report Generator */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold mb-4"><Trans>Generate monthly report</Trans></h2>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2"><Trans>Customer</Trans></label>
              <select
                value={selectedCustomer?.id || ''}
                onChange={(e) => {
                  const customer = customers.find(c => c.id === parseInt(e.target.value))
                  setSelectedCustomer(customer)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              >
                <option value="">{t`Select a customer`}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2"><Trans>Month</Trans></label>
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
              <label className="block text-sm font-medium mb-2"><Trans>Year</Trans></label>
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
              {loading ? <Trans>Generating...</Trans> : <Trans>Show report</Trans>}
            </button>

            {report && (
              <button
                onClick={handleDownloadPDF}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                <Trans>Download PDF</Trans>
              </button>
            )}
          </div>

          <ErrorMessage message={error} />
        </div>
      </div>

      {/* Report Display */}
      {report && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4">
            <Trans>Report {reportCustomer} – {reportPeriod}</Trans>
          </h3>

          {report.entries.length > 0 ? (
            <>
              <div className="overflow-x-auto mb-6">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left"><Trans>Date</Trans></th>
                      <th className="border border-gray-300 px-4 py-2 text-left"><Trans>Project</Trans></th>
                      <th className="border border-gray-300 px-4 py-2 text-right"><Trans>Hours</Trans></th>
                      <th className="border border-gray-300 px-4 py-2 text-left"><Trans>Description</Trans></th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.entries.map((entry) => {
                      const hours = formatHours(i18n, hoursBetween(entry.start_time, entry.end_time))
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-2">
                            {i18n.date(entry.start_time, { year: 'numeric', month: 'numeric', day: 'numeric' })}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">{entry.project_name}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">{hours}</td>
                          <td className="border border-gray-300 px-4 py-2 text-sm">{entry.description || '---'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-50 p-4 rounded border border-gray-300">
                <div className="flex justify-between font-bold">
                  <span><Trans>TOTAL HOURS:</Trans></span>
                  <span>{formatHours(i18n, report.totalHours)}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-gray-500"><Trans>No entries for this period</Trans></p>
          )}
        </div>
      )}
    </div>
  )
}

export default Reports
