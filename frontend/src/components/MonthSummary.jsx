import { useId } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { formatAmount, formatHours } from '../format'
import { inMonth, summarize } from '../summary'
import { ui } from '../ui'

// The current month of a customer: hours, billable amount (hours × hourly rate), entries and hours per project.
// Running entries don't count yet. onOpenReport opens the monthly report.
function MonthSummary({ entries, projects, onOpenReport, now = new Date() }) {
  const { i18n } = useLingui()
  const headingId = useId()
  const summary = summarize(entries.filter((e) => inMonth(e, now)), projects)
  const month = i18n.date(now, { month: 'long', year: 'numeric' })

  const figures = [
    { label: <Trans>Hours this month</Trans>, value: formatHours(i18n, summary.hours) },
    { label: <Trans>Billable amount</Trans>, value: formatAmount(i18n, summary.amount) },
    { label: <Trans>Entries</Trans>, value: i18n.number(summary.count) },
  ]

  return (
    <section aria-labelledby={headingId} className={`${ui.card} flex flex-col gap-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className={ui.eyebrow}>{month}</h2>
        <button type="button" onClick={onOpenReport} className="text-sm font-medium text-accent underline underline-offset-2 hover:text-accent-dark">
          <Trans>Open report</Trans>
        </button>
      </div>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {figures.map((figure, index) => (
          <div key={index} className="flex flex-col gap-1">
            <dt className="text-sm text-muted">{figure.label}</dt>
            <dd className={ui.figure}>{figure.value}</dd>
          </div>
        ))}
      </dl>

      {summary.projects.length > 0 ? (
        <ul className="flex flex-col gap-2.5 border-t border-line-soft pt-4 text-sm">
          {summary.projects.map(({ project, hours }) => (
            <li key={project.id} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate">{project.name}</span>
              <span aria-hidden="true" className="flex h-2 flex-1 rounded-sm bg-line-soft">
                <span className="rounded-sm bg-accent" style={{ width: `${(hours / summary.hours) * 100}%` }} />
              </span>
              <span className="w-20 shrink-0 text-right font-mono">{formatHours(i18n, hours)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-line-soft pt-4 text-sm text-muted"><Trans>No time recorded this month yet.</Trans></p>
      )}
    </section>
  )
}

export default MonthSummary
