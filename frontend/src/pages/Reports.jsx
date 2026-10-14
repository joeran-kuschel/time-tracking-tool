import { useEffect, useId, useState } from 'react'
import { ArrowDownTrayIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '../api'
import { useAction } from '../hooks/useAction'
import ErrorMessage from '../components/ErrorMessage'
import { formatAmount, formatHours, hoursBetween } from '../format'
import { projectsOf, summarize } from '../summary'
import { ui } from '../ui'

const cell = 'px-3 py-3 border-b border-line-soft'
const headCell = 'px-3 py-2.5 border-b border-ink text-sm font-medium text-muted'
const footCell = 'px-3 py-3.5 border-t border-ink font-semibold'

const statuses = [
  { value: 'draft', label: msg`Draft` },
  { value: 'ready', label: msg`Ready to send` },
  { value: 'sent', label: msg`Sent` },
]

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
  const [loading, setLoading] = useState(false)
  const [run, error] = useAction()
  const [runStatus, statusError] = useAction()
  const [runDownload, downloadError] = useAction()
  const { t, i18n } = useLingui()
  const customerFieldId = useId()
  const statusFieldId = useId()
  const monthLabelId = useId()
  const reportHeadingId = useId()

  useEffect(() => {
    setReport(null)
    if (!customerId) return
    // Only the answer for the current choice is shown
    let current = true
    setLoading(true)
    run(() => api.getMonthlyReport(customerId, period.month, period.year), msg`Report could not be loaded.`).then((data) => {
      if (!current) return
      if (data) setReport(data)
      setLoading(false)
    })
    return () => { current = false }
  }, [customerId, period])

  const shiftMonth = (delta) => {
    const date = new Date(period.year, period.month - 1 + delta, 1)
    setPeriod({ year: date.getFullYear(), month: date.getMonth() + 1 })
  }

  const handleDownloadPDF = () =>
    runDownload(() => api.downloadPDF(customerId, period.month, period.year, i18n.locale), msg`PDF could not be downloaded.`)

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
  const summary = report && summarize(report.entries, projectsOf(report.entries))

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

        {hasEntries && (
          <button onClick={handleDownloadPDF} className={`${ui.buttonPrimary} ml-auto min-h-[2.75rem]`}>
            <ArrowDownTrayIcon aria-hidden="true" className="h-5 w-5" />
            <Trans>Download PDF</Trans>
          </button>
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
              <dl className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5 rounded-xl bg-paper/70 px-5 py-4">
                  <dt className="text-sm text-muted"><Trans>Total hours</Trans></dt>
                  <dd className={ui.figure}>{formatHours(i18n, summary.hours)}</dd>
                </div>
                <div className="flex flex-col gap-1.5 rounded-xl bg-paper/70 px-5 py-4">
                  <dt className="text-sm text-muted"><Trans>Amount (net)</Trans></dt>
                  <dd className={ui.figure}>{formatAmount(i18n, summary.amount)}</dd>
                </div>
                <div className="flex flex-col gap-1.5 rounded-xl bg-paper/70 px-5 py-4">
                  <dt className="text-sm text-muted"><Trans>Projects</Trans></dt>
                  <dd>
                    <ul className="text-[0.9375rem] leading-relaxed">
                      {summary.projects.map(({ project, hours }) => (
                        <li key={project.id}>{project.name} · {formatHours(i18n, hours)}</li>
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
                      <th scope="col" className={`${headCell} text-right`}><Trans>Amount</Trans></th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.entries.map((entry) => {
                      const hours = hoursBetween(entry.start_time, entry.end_time)
                      return (
                        <tr key={entry.id}>
                          <td className={`${cell} whitespace-nowrap`}>
                            {i18n.date(entry.start_time, { year: 'numeric', month: 'numeric', day: 'numeric' })}
                          </td>
                          <td className={cell}>{entry.project_name}</td>
                          <td className={cell}>{entry.description || <span className="text-muted">—</span>}</td>
                          <td className={`${cell} whitespace-nowrap text-right font-mono text-sm`}>{formatHours(i18n, hours)}</td>
                          <td className={`${cell} whitespace-nowrap text-right font-mono text-sm`}>
                            {formatAmount(i18n, hours * Number(entry.hourly_rate ?? 0))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" colSpan={3} className={`${footCell} text-left`}><Trans>Total</Trans></th>
                      <td className={`${footCell} whitespace-nowrap text-right font-mono text-sm`}>{formatHours(i18n, summary.hours)}</td>
                      <td className={`${footCell} whitespace-nowrap text-right font-mono text-sm`}>{formatAmount(i18n, summary.amount)}</td>
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
