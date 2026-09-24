import { useId } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { formatDay, formatHours, hoursBetween } from '../../format'
import { ui } from '../../ui'

// The latest finished entries of all customers. Selecting one opens its customer and project on the
// Time tracking page; View all opens the customer of the newest entry.
function RecentEntries({ entries, onSelect }) {
  const { i18n } = useLingui()
  const headingId = useId()
  const newest = entries[0]

  return (
    <section aria-labelledby={headingId} className={`${ui.card} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-lg font-semibold"><Trans>Recent entries</Trans></h2>
        {newest && (
          <button
            type="button"
            onClick={() => onSelect(newest.customer_id)}
            className="inline-flex min-h-[2.75rem] items-center text-sm font-medium text-accent underline underline-offset-2 hover:text-accent-dark"
          >
            <Trans>View all</Trans>
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted"><Trans>No entries yet.</Trans></p>
      ) : (
        <ul className="flex flex-col">
          {entries.map((entry) => (
            <li key={entry.id} className="border-b border-line-soft last:border-b-0">
              <button
                type="button"
                onClick={() => onSelect(entry.customer_id, entry.project_id)}
                className="flex min-h-[2.75rem] w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-paper"
              >
                <span className="w-24 shrink-0 text-sm text-muted">{formatDay(i18n, entry.start_time)}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{entry.description || <span className="text-muted"><Trans>No description</Trans></span>}</span>
                  <span className="truncate text-sm text-muted">{entry.customer_name} · {entry.project_name}</span>
                </span>
                <span className="shrink-0 font-mono text-sm">{formatHours(i18n, hoursBetween(entry.start_time, entry.end_time))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default RecentEntries
