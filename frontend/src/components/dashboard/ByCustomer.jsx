import { useId } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { formatAmount, formatHours } from '../../format'
import { ui } from '../../ui'

// Hours of the month per customer as horizontal bars, with projects and amount.
// rows: from byCustomer(); onSelect(customerId) opens the customer on the Time tracking page.
function ByCustomer({ rows, now, onSelect }) {
  const { i18n } = useLingui()
  const headingId = useId()
  const monthName = i18n.date(now, { month: 'long' })
  const most = Math.max(...rows.map((r) => r.hours), 0)

  return (
    <section aria-labelledby={headingId} className={`${ui.card} flex flex-col gap-3`}>
      <h2 id={headingId} className="text-lg font-semibold"><Trans>By customer · {monthName}</Trans></h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted"><Trans>No time recorded this month yet.</Trans></p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((row) => (
            <li key={row.customerId}>
              <button
                type="button"
                onClick={() => onSelect(row.customerId)}
                className="flex min-h-[2.75rem] w-full flex-col gap-1.5 rounded-lg px-2 py-2 text-left hover:bg-paper"
              >
                <span className="flex w-full items-baseline justify-between gap-3">
                  <span className="truncate font-medium">{row.name}</span>
                  <span className="shrink-0 font-mono text-sm">{formatHours(i18n, row.hours)}</span>
                </span>
                <span aria-hidden="true" className="flex h-2 w-full rounded bg-line-soft">
                  <span className="rounded bg-accent" style={{ width: `${(row.hours / most) * 100}%` }} />
                </span>
                <span className="text-sm text-muted">
                  {row.projects.map((p) => p.project.name).join(', ')} · {formatAmount(i18n, row.amount)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default ByCustomer
