import { useId } from 'react'
import { Link } from 'react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '../../api'
import { formatAmount, formatHours, formatRate } from '../../format'
import { reportPath, trackingPath } from '../../routes'
import { ui } from '../../ui'

const cell = 'px-3 py-2.5 border-b border-line-soft'
const headCell = 'px-3 py-2.5 border-b border-ink text-sm font-medium text-muted'
const footCell = 'px-3 py-3 border-t border-ink font-semibold'
const link = 'inline-flex min-h-[2.75rem] items-center text-sm font-medium text-accent underline underline-offset-2 hover:text-accent-dark'

// The month's billing per customer, with a PDF preview of each report, and a notice about last month's
// reports that are not sent yet. rows: from byCustomer(); lastMonthReports: from GET /api/dashboard.
function BillingTable({ rows, now, lastMonthReports }) {
  const { t, i18n } = useLingui()
  const headingId = useId()
  const monthName = i18n.date(now, { month: 'long', year: 'numeric' })
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const totalHours = rows.reduce((sum, r) => sum + r.hours, 0)
  const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0)

  const { reports } = lastMonthReports
  const unsent = reports.filter((r) => r.status !== 'sent')
  const sent = reports.length - unsent.length
  const total = reports.length
  const lastMonthName = i18n.date(new Date(lastMonthReports.year, lastMonthReports.month - 1, 1), { month: 'long' })
  const statusLabel = { draft: t`draft`, ready: t`ready to send` }

  return (
    <section aria-labelledby={headingId} className={`${ui.card} flex flex-col gap-4`}>
      <h2 id={headingId} className="text-lg font-semibold"><Trans>Billing · {monthName}</Trans></h2>

      {rows.length === 0 ? (
        <p className="text-sm text-muted"><Trans>No time recorded this month yet.</Trans></p>
      ) : (
        <div className="overflow-x-auto">
          <table aria-labelledby={headingId} className="w-full border-collapse text-[0.9375rem]">
            <thead>
              <tr className="text-left">
                <th scope="col" className={headCell}><Trans>Customer</Trans></th>
                <th scope="col" className={`${headCell} text-right`}><Trans>Projects</Trans></th>
                <th scope="col" className={`${headCell} text-right`}><Trans>Hours</Trans></th>
                <th scope="col" className={`${headCell} text-right`}><Trans>Rate</Trans></th>
                <th scope="col" className={`${headCell} text-right`}><Trans>Amount</Trans></th>
                <th scope="col" className={headCell}><Trans>Report</Trans></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const customerName = row.name
                return (
                  <tr key={row.customerId}>
                    <th scope="row" className={`${cell} text-left font-normal`}>
                      <Link to={trackingPath(row.customerId)} className={`${link} text-left text-[0.9375rem] text-ink`}>
                        {row.name}
                      </Link>
                    </th>
                    <td className={`${cell} text-right font-mono text-sm`}>{i18n.number(row.projects.length)}</td>
                    <td className={`${cell} whitespace-nowrap text-right font-mono text-sm`}>{formatHours(i18n, row.hours)}</td>
                    <td className={`${cell} whitespace-nowrap text-right font-mono text-sm`}>
                      {row.rates.map((rate) => formatRate(i18n, rate)).join(', ')}
                    </td>
                    <td className={`${cell} whitespace-nowrap text-right font-mono text-sm`}>{formatAmount(i18n, row.amount)}</td>
                    <td className={`${cell} whitespace-nowrap`}>
                      <a
                        href={api.pdfPreviewUrl(row.customerId, month, year, i18n.locale)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t`Preview PDF for ${customerName} (opens in a new tab)`}
                        className={link}
                      >
                        <Trans>Preview PDF</Trans>
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={2} className={`${footCell} text-left`}><Trans>Total</Trans></th>
                <td className={`${footCell} whitespace-nowrap text-right font-mono text-sm`}>{formatHours(i18n, totalHours)}</td>
                <td className={footCell} />
                <td className={`${footCell} whitespace-nowrap text-right font-mono text-sm`}>{formatAmount(i18n, totalAmount)}</td>
                <td className={footCell} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {unsent.length > 0 && (
        <div className="rounded-lg bg-paper p-4 text-sm">
          <p className="font-medium"><Trans>{lastMonthName}: {sent} of {total} reports sent.</Trans></p>
          <ul className="mt-1">
            {unsent.map((report) => {
              const customerName = report.customer_name
              const status = statusLabel[report.status]
              return (
                <li key={report.customer_id} className="flex flex-wrap items-center gap-x-3">
                  <span><Trans>{customerName}: {status}</Trans></span>
                  <Link
                    to={reportPath(report.customer_id, lastMonthReports.year, lastMonthReports.month)}
                    aria-label={t`Open report for ${customerName}`}
                    className={link}
                  >
                    <Trans>Open report</Trans>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}

export default BillingTable
