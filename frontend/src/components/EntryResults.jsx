import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { formatClock, formatDay, formatHours, hoursBetween } from '../format'
import { trackingPath } from '../routes'
import { ui } from '../ui'

const headCell = 'px-3 py-2 border-b border-line font-medium text-muted'
// Below sm every row is a card and every cell shows its column name (data-label) in front
const cell = 'px-3 py-1.5 border-b border-line-soft max-sm:block max-sm:border-b-0 max-sm:py-0.5 max-sm:before:mr-2 max-sm:before:text-muted max-sm:before:content-[attr(data-label)]'

// The result of a search: a status line, the entries (a table, cards on narrow screens) and Show more.
// results: { entries, total, hours } or null before the first answer. The status line is the only live region and
// shows the loaded results, so it changes once per answer and not while loading.
function EntryResults({ results, busy, loadingMore, onShowMore }) {
  const { t, i18n } = useLingui()
  const headingId = useId()
  const list = useRef(null)
  const showingMore = useRef(null)
  const entries = results?.entries ?? []
  const shown = entries.length
  const total = results?.total ?? 0
  const hasMore = shown < total

  // The Show more button is gone once everything is loaded, so focus moves to the list
  useEffect(() => {
    // Only when a page was appended to what the click saw: a later search must not take focus from its field
    if (!hasMore && showingMore.current !== null && shown > showingMore.current) {
      list.current?.focus()
    }
    if (!hasMore) showingMore.current = null
  }, [hasMore, shown])

  const showMore = () => {
    if (loadingMore) return
    showingMore.current = shown
    onShowMore()
  }

  const labels = { date: t`Date`, customer: t`Customer`, project: t`Project`, time: t`Time`, hours: t`Hours`, description: t`Description` }

  return (
    <section aria-labelledby={headingId} aria-busy={busy} className={`${ui.card} flex flex-col gap-4`}>
      <h2 id={headingId} className="text-lg font-semibold"><Trans>Results</Trans></h2>
      <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-muted">
        {results && (results.total === 0
          ? <Trans>No entries found</Trans>
          : <><Plural value={results.total} one="# entry" other="# entries" />, {formatHours(i18n, results.hours)}</>)}
      </p>

      {entries.length > 0 && (
        <div ref={list} tabIndex={-1} className="overflow-x-auto focus:outline-none">
          <table className="w-full border-collapse text-sm">
            <thead className="max-sm:sr-only">
              <tr className="text-left">
                <th scope="col" className={headCell}>{labels.date}</th>
                <th scope="col" className={headCell}>{labels.customer}</th>
                <th scope="col" className={headCell}>{labels.project}</th>
                <th scope="col" className={headCell}>{labels.time}</th>
                <th scope="col" className={`${headCell} text-right`}>{labels.hours}</th>
                <th scope="col" className={headCell}>{labels.description}</th>
                <th scope="col" className={`${headCell} text-right`}><Trans>Actions</Trans></th>
              </tr>
            </thead>
            <tbody className="max-sm:block">
              {entries.map((entry) => {
                const running = !entry.end_time
                const day = formatDay(i18n, entry.start_time)
                const customerName = entry.customer_name
                return (
                  <tr key={entry.id} className="max-sm:mb-3 max-sm:block max-sm:rounded-lg max-sm:border max-sm:border-line max-sm:p-3">
                    <td data-label={labels.date} className={`${cell} whitespace-nowrap`}>{day}</td>
                    <td data-label={labels.customer} className={cell}>{entry.customer_name}</td>
                    <td data-label={labels.project} className={cell}>{entry.project_name}</td>
                    <td data-label={labels.time} className={`${cell} whitespace-nowrap font-mono`}>
                      {formatClock(i18n, entry.start_time)} –{' '}
                      {running
                        ? <span className="font-sans font-semibold text-danger"><Trans>running</Trans></span>
                        : formatClock(i18n, entry.end_time)}
                    </td>
                    <td data-label={labels.hours} className={`${cell} whitespace-nowrap font-mono sm:text-right`}>
                      {formatHours(i18n, hoursBetween(entry.start_time, entry.end_time))}
                    </td>
                    <td data-label={labels.description} className={cell}>
                      {entry.description || <span className="text-muted"><Trans>No description</Trans></span>}
                    </td>
                    <td className={`${cell} max-sm:pt-2 sm:text-right`}>
                      <Link
                        to={trackingPath(entry.customer_id, entry.project_id)}
                        className={`${ui.buttonSecondary} min-h-[2.75rem] min-w-[5rem] whitespace-nowrap`}
                      >
                        <Trans>Open</Trans>{' '}
                        <span className="sr-only"><Trans>in Time tracking</Trans>: {customerName}, {day}</span>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {results && hasMore && (
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={showMore} aria-disabled={loadingMore || undefined} className={ui.buttonSecondary}>
            <Trans>Show more</Trans>
          </button>
          <p className="text-sm text-muted">{t`Showing ${shown} of ${total}`}</p>
        </div>
      )}
    </section>
  )
}

export default EntryResults
