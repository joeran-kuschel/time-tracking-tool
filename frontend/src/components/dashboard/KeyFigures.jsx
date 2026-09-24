import { useId } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { formatAmount, formatHours } from '../../format'
import { byCustomer, monthEntries, startOfWeek, weekHours, workingDaysSoFar } from '../../dashboard'
import { ui } from '../../ui'

// Four figures: hours this week, hours this month (with the average per working day so far),
// the billable amount of the month, and how many of last month's reports were sent.
// lastMonthReports: { month, year, reports: [{ customer_id, customer_name, status }] }
function KeyFigures({ entries, lastMonthReports, now }) {
  const { i18n } = useLingui()
  const headingId = useId()

  const month = monthEntries(entries, now)
  const customers = byCustomer(month)
  const monthHours = customers.reduce((sum, c) => sum + c.hours, 0)
  const monthAmount = customers.reduce((sum, c) => sum + c.amount, 0)
  const workingDays = workingDaysSoFar(now)

  const weekStart = i18n.date(startOfWeek(now), { weekday: 'short', day: 'numeric' })
  const today = i18n.date(now, { weekday: 'short', day: 'numeric', month: 'short' })
  const perDay = formatHours(i18n, workingDays ? monthHours / workingDays : 0)
  const days = i18n.number(workingDays)
  const monthName = i18n.date(now, { month: 'long' })
  const reports = lastMonthReports.reports
  const sent = reports.filter((r) => r.status === 'sent').length
  const total = reports.length
  const lastMonthName = i18n.date(new Date(lastMonthReports.year, lastMonthReports.month - 1, 1), { month: 'long' })

  const figures = [
    { label: <Trans>This week</Trans>, value: formatHours(i18n, weekHours(entries, now)), note: <Trans>{weekStart} to {today}</Trans> },
    { label: <Trans>This month</Trans>, value: formatHours(i18n, monthHours), note: <Trans>{days} working days, {perDay} per day</Trans> },
    { label: <Trans>Billable in {monthName}</Trans>, value: formatAmount(i18n, monthAmount), note: <Trans>Hours × hourly rate of each project</Trans> },
    {
      label: <Trans>Reports sent for {lastMonthName}</Trans>,
      value: total ? <Trans>{sent} of {total}</Trans> : '–',
      note: total ? null : <Trans>No entries in {lastMonthName}</Trans>,
    },
  ]

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only"><Trans>Key figures</Trans></h2>
      <dl className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2">
        {figures.map((figure, index) => (
          <div key={index} className={`${ui.card} flex flex-col gap-2`}>
            <dt className="text-sm text-muted">{figure.label}</dt>
            <dd className={ui.figure}>{figure.value}</dd>
            {figure.note && <dd className="text-sm text-muted">{figure.note}</dd>}
          </div>
        ))}
      </dl>
    </section>
  )
}

export default KeyFigures
