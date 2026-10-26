import { useEffect, useId, useRef, useState } from 'react'
import { ArrowDownTrayIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '../api'
import { useAction } from '../hooks/useAction'
import ErrorMessage from '../components/ErrorMessage'
import { formatAmount, formatHours, formatRate, hoursBetween } from '../format'
import { saveShowAmounts, storedShowAmounts } from '../reportOptions'
import { ui } from '../ui'

const cell = 'px-3 py-3 border-b border-line-soft'
const headCell = 'px-3 py-2.5 border-b border-ink text-sm font-medium text-muted'
const footCell = 'px-3 py-3.5 border-t border-ink font-semibold'

const statuses = [
  { value: 'draft', label: msg`Draft` },
  { value: 'ready', label: msg`Ready to send` },
  { value: 'sent', label: msg`Sent` },
]

// Hours of an entry in hundredths, rounded like the backend does (toFixed(2) in utils/hours.js, which also gives the
// PDF and CSV rows); a running entry has none yet. Whole hundredths add up without float errors.
const hundredthsOf = (entry) => Math.round(Number(hoursBetween(entry.start_time, entry.end_time).toFixed(2)) * 100)

// Hours per project in hundredths, in the order the projects first appear: [{ id, name, hundredths }]
function projectHours(entries) {
  const byId = new Map()
  for (const entry of entries) {
    const project = byId.get(entry.project_id) ?? { id: entry.project_id, name: entry.project_name, hundredths: 0 }
    // like the server's project lines (utils/amounts.js), an entry that ends before it starts counts as 0 here
    project.hundredths += Math.max(0, hundredthsOf(entry))
    byId.set(entry.project_id, project)
  }
  return [...byId.values()]
}

// A customer's month: the report loads as soon as customer or month change.
// initialCustomerId, initialMonth and initialYear preselect them, e.g. from "Open report" on another page;
// without a month, the current one opens.
function Reports({ customers, initialCustomerId = null, initialMonth, initialYear }) {
  const [customerId, setCustomerId] = useState(initialCustomerId)
  const [period, setPeriod] = useState(() => {
    if (initialMonth && initialYear) return { year: initialYear, month: initialMonth }
    const today = new Date()
    return { year: today.getFullYear(), month: today.getMonth() + 1 }
  })
  const [report, setReport] = useState(null)
  const [showAmounts, setShowAmounts] = useState(storedShowAmounts)
  const [loading, setLoading] = useState(false)
  const [run, error] = useAction()
  const [runStatus, statusError] = useAction()
  const [runDownload, downloadError] = useAction()
  const [downloading, setDownloading] = useState(false)
  const downloadRunning = useRef(false)
  const { t, i18n } = useLingui()
  const customerFieldId = useId()
  const statusFieldId = useId()
  const amountsFieldId = useId()
  const monthLabelId = useId()
  const reportHeadingId = useId()

  useEffect(() => {
    setReport(null)
    if (!customerId) return
    // Only the answer for the current choice is shown
    let current = true
    setLoading(true)
    run(() => api.getMonthlyReport(customerId, period.month, period.year, showAmounts), msg`Report could not be loaded.`).then((data) => {
      if (!current) return
      if (data) setReport(data)
      setLoading(false)
    })
    return () => { current = false }
  }, [customerId, period, showAmounts])

  const shiftMonth = (delta) => {
    const date = new Date(period.year, period.month - 1 + delta, 1)
    setPeriod({ year: date.getFullYear(), month: date.getMonth() + 1 })
  }

  // One download at a time: while one runs, both buttons are marked disabled and ignore clicks.
  // The ref also stops a second click that comes before the next render.
  const download = async (call, failureMessage) => {
    if (downloadRunning.current) return
    downloadRunning.current = true
    setDownloading(true)
    await runDownload(call, failureMessage)
    downloadRunning.current = false
    setDownloading(false)
  }
  const handleDownloadPDF = () =>
    download(() => api.downloadPDF(customerId, period.month, period.year, i18n.locale, showAmounts), msg`PDF could not be downloaded.`)
  const handleDownloadCSV = () =>
    download(() => api.downloadCSV(customerId, period.month, period.year, i18n.locale, showAmounts), msg`CSV could not be downloaded.`)

  const changeStatus = async (status) => {
    const saved = await runStatus(
      () => api.setReportStatus(customerId, period.month, period.year, status),
      msg`Report status could not be saved.`
    )
    if (saved) setReport((current) => ({ ...current, status: saved.status }))
  }

  const customer = customers.find((c) => c.id === customerId)
  const reportCustomer = customer?.name
  const reportPeriod = i18n.date(new Date(period.year, period.month - 1, 1), { month: 'long', year: 'numeric' })
  const hasEntries = report?.entries.length > 0
  const changeShowAmounts = (show) => {
    setShowAmounts(show)
    saveShowAmounts(show)
  }
  // The report on screen follows what it was loaded with, so a toggle never meets a report without amounts
  const withAmounts = report?.totalAmount !== undefined
  const totalHundredths = report ? report.entries.reduce((sum, entry) => sum + hundredthsOf(entry), 0) : 0

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:px-8 sm:py-9">
      <h1 className="sr-only"><Trans>Reports</Trans></h1>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor={customerFieldId} className={ui.label}><Trans>Customer</Trans></label>
          <select
            id={customerFieldId}
            value={customerId ?? ''}
            onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : null)}
            className={`${ui.select} w-72 max-w-full`}
          >
            <option value="">{t`Select a customer`}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div role="group" aria-labelledby={monthLabelId}>
          <span id={monthLabelId} className={ui.label}><Trans>Month</Trans></span>
          <div className="flex min-h-[2.75rem] items-stretch rounded-lg border border-line-strong bg-surface">
            <button type="button" onClick={() => shiftMonth(-1)} title={t`Previous month`} className="flex w-11 items-center justify-center rounded-l-lg border-r border-line hover:bg-paper">
              <ChevronLeftIcon aria-hidden="true" className="h-4 w-4" />
            </button>
            <span aria-live="polite" className="flex w-44 items-center justify-center font-medium">{reportPeriod}</span>
            <button type="button" onClick={() => shiftMonth(1)} title={t`Next month`} className="flex w-11 items-center justify-center rounded-r-lg border-l border-line hover:bg-paper">
              <ChevronRightIcon aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {hasEntries && (
          <div>
            <label htmlFor={statusFieldId} className={ui.label}><Trans>Status</Trans></label>
            <select
              id={statusFieldId}
              value={report.status ?? 'draft'}
              onChange={(e) => changeStatus(e.target.value)}
              className={`${ui.select} w-48`}
            >
              {statuses.map((s) => <option key={s.value} value={s.value}>{i18n._(s.label)}</option>)}
            </select>
          </div>
        )}

        {customerId && (
          <label className="flex min-h-[2.75rem] items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={showAmounts}
              onChange={(e) => changeShowAmounts(e.target.checked)}
              className="h-5 w-5 accent-accent"
            />
            <Trans>Show hourly rate and amounts</Trans>
          </label>
        )}

        {hasEntries && (
          <div className="ml-auto flex flex-wrap gap-3">
            <button type="button" onClick={handleDownloadCSV} aria-disabled={downloading} className={`${ui.buttonSecondary} min-h-[2.75rem] aria-disabled:opacity-70`}>
              <ArrowDownTrayIcon aria-hidden="true" className="h-5 w-5" />
              <Trans>Download CSV</Trans>
            </button>
            <button type="button" onClick={handleDownloadPDF} aria-disabled={downloading} className={`${ui.buttonPrimary} min-h-[2.75rem] aria-disabled:opacity-70`}>
              <ArrowDownTrayIcon aria-hidden="true" className="h-5 w-5" />
              <Trans>Download PDF</Trans>
            </button>
          </div>
        )}
      </div>

      <ErrorMessage message={error} />
      <ErrorMessage message={statusError} />
      <ErrorMessage message={downloadError} />
      {!customerId && <p className="text-muted"><Trans>Select a customer to see the report.</Trans></p>}
      {loading && <p className="text-muted"><Trans>Loading...</Trans></p>}

      {report && (
        <section aria-labelledby={reportHeadingId} className={`${ui.card} flex flex-col gap-7 sm:px-9 sm:py-8`}>
          <div>
            <p className={ui.eyebrow}><Trans>Monthly report</Trans></p>
            <h2 id={reportHeadingId} className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">
              <Trans>Report {reportCustomer} – {reportPeriod}</Trans>
            </h2>
          </div>

          {hasEntries ? (
            <>
              <dl className={`grid gap-4 ${withAmounts ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                <div className="flex flex-col gap-1.5 rounded-xl bg-paper/70 px-5 py-4">
                  <dt className="text-sm text-muted"><Trans>Total hours</Trans></dt>
                  <dd className={ui.figure}>{formatHours(i18n, totalHundredths / 100)}</dd>
                </div>
                {withAmounts && (
                  <div className="flex flex-col gap-1.5 rounded-xl bg-paper/70 px-5 py-4">
                    <dt className="text-sm text-muted"><Trans>Amount (net)</Trans></dt>
                    <dd className={ui.figure}>{formatAmount(i18n, report.totalAmount)}</dd>
                  </div>
                )}
                <div className="flex flex-col gap-1.5 rounded-xl bg-paper/70 px-5 py-4">
                  <dt className="text-sm text-muted"><Trans>Projects</Trans></dt>
                  <dd>
                    <ul className="text-[0.9375rem] leading-relaxed">
                      {withAmounts
                        ? report.projects.map((p) => (
                          <li key={p.projectId}>
                            {p.name} · {formatHours(i18n, p.hours)} · {formatRate(i18n, p.hourlyRate)} · {formatAmount(i18n, p.amount)}
                          </li>
                        ))
                        : projectHours(report.entries).map((p) => (
                          <li key={p.id}>{p.name} · {formatHours(i18n, p.hundredths / 100)}</li>
                        ))}
                    </ul>
                  </dd>
                </div>
              </dl>

              <div className="overflow-x-auto">
                <table aria-labelledby={reportHeadingId} className="w-full border-collapse text-[0.9375rem]">
                  <thead>
                    <tr className="text-left">
                      <th scope="col" className={headCell}><Trans>Date</Trans></th>
                      <th scope="col" className={headCell}><Trans>Project</Trans></th>
                      <th scope="col" className={headCell}><Trans>Description</Trans></th>
                      <th scope="col" className={`${headCell} text-right`}><Trans>Hours</Trans></th>
                      {withAmounts && <th scope="col" className={`${headCell} text-right`}><Trans>Amount</Trans></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {report.entries.map((entry) => (
                      <tr key={entry.id}>
                        <td className={`${cell} whitespace-nowrap`}>
                          {i18n.date(entry.start_time, { year: 'numeric', month: 'numeric', day: 'numeric' })}
                        </td>
                        <td className={cell}>{entry.project_name}</td>
                        <td className={cell}>{entry.description || <span className="text-muted">—</span>}</td>
                        <td className={`${cell} whitespace-nowrap text-right font-mono text-sm`}>{formatHours(i18n, hundredthsOf(entry) / 100)}</td>
                        {withAmounts && (
                          <td className={`${cell} whitespace-nowrap text-right font-mono text-sm`}>{formatAmount(i18n, entry.amount)}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" colSpan={3} className={`${footCell} text-left`}><Trans>Total</Trans></th>
                      <td className={`${footCell} whitespace-nowrap text-right font-mono text-sm`}>{formatHours(i18n, totalHundredths / 100)}</td>
                      {withAmounts && (
                        <td className={`${footCell} whitespace-nowrap text-right font-mono text-sm`}>{formatAmount(i18n, report.totalAmount)}</td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          ) : (
            <p className="text-muted"><Trans>No entries for this period</Trans></p>
          )}
        </section>
      )}
    </div>
  )
}

export default Reports
