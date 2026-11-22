import { useId } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { formatAmount, formatDuration } from '../../format'
import Duration from '../Duration'
import { byCustomer, monthEntries, startOfWeek, trackedMinutes, weekMinutes, workingDaysSoFar } from '../../dashboard'
import { ui } from '../../ui'

// Four figures: hours this week, hours this month (with the average per working day so far),
// the billable amount of the month, and how many of last month's reports were sent.
// The hours are the tracked time, exact; the billable amount counts the rounded time when there is a rounding rule.
// lastMonthReports: { month, year, reports: [{ customer_id, customer_name, status }] }
// rounding: { minutes, direction } of the rule, or null/undefined
// firstDay: the first day of the week, 1 Monday or 0 Sunday (the setting)
function KeyFigures({ entries, lastMonthReports, now, rounding, firstDay }) {
  const { i18n } = useLingui()
  const headingId = useId()

  const month = monthEntries(entries, now)
  const customers = byCustomer(month)
  const monthMinutes = trackedMinutes(month)
  const monthAmount = customers.reduce((sum, c) => sum + c.amount, 0)
  const workingDays = workingDaysSoFar(now)

  const weekStart = i18n.date(startOfWeek(now, firstDay), { weekday: 'short', day: 'numeric' })
  const today = i18n.date(now, { weekday: 'short', day: 'numeric', month: 'short' })
  const perDay = formatDuration(i18n, workingDays ? monthMinutes / workingDays : 0)
  const days = i18n.number(workingDays)
  const monthName = i18n.date(now, { month: 'long' })
  const reports = lastMonthReports.reports
  const sent = reports.filter((r) => r.status === 'sent').length
  const total = reports.length
  const lastMonthName = i18n.date(new Date(lastMonthReports.year, lastMonthReports.month - 1, 1), { month: 'long' })

  const figures = [
    { label: <Trans>This week</Trans>, value: <Duration minutes={weekMinutes(entries, now, firstDay)} />, note: <Trans>{weekStart} to {today}</Trans> },
    { label: <Trans>This month</Trans>, value: <Duration minutes={monthMinutes} />, note: <Trans>{days} working days, {perDay} per day</Trans> },
    { label: <Trans>Billable in {monthName}</Trans>, value: formatAmount(i18n, monthAmount), note: rounding ? <Trans>Rounded hours × hourly rate of each project</Trans> : <Trans>Hours × hourly rate of each project</Trans> },
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
