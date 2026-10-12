import { useId, useState } from 'react'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { dailyHours, weeklyHours } from '../../dashboard'
import { formatDay, formatHours } from '../../format'
import { ui } from '../../ui'

const views = [
  { id: 'days', label: msg`Days`, scale: 8 },
  { id: 'weeks', label: msg`Weeks`, scale: 40 },
]

const sameDay = (a, b) => a.toDateString() === b.toDateString()

// Hours of the month per day or per calendar week, as bars. Hovering or focusing a bar shows its value
// next to the title; without one, the month total shows. The chart is one tab stop: the arrow keys move
// between bars. A visually hidden table carries the same values for screen readers.
function HoursChart({ entries, now }) {
  const [view, setView] = useState('days')
  const [active, setActive] = useState(null)
  const { t, i18n } = useLingui()
  const headingId = useId()
  const readoutId = useId()

  const dayMonth = (date) => i18n.date(date, { day: 'numeric', month: 'short' })
  const bars = view === 'days'
    ? dailyHours(entries, now).map(({ date, hours }) => {
        const day = formatDay(i18n, date)
        const isToday = sameDay(date, now)
        return {
          name: day,
          hours,
          future: date > now && !isToday,
          current: isToday,
          label: isToday ? t`Today` : date.getDate() === 1 || date.getDay() === 1 ? i18n.number(date.getDate()) : '',
          sub: '',
        }
      })
    : weeklyHours(entries, now).map(({ week, start, end, hours }) => {
        const range = sameDay(start, end) ? dayMonth(start) : `${dayMonth(start)} – ${dayMonth(end)}`
        const current = now >= start && now < new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)
        return {
          name: t`Week ${week}, ${range}`,
          hours,
          future: start > now,
          current,
          label: current ? t`This week` : t`Week ${week}`,
          sub: range,
        }
      })

  const { scale: minScale } = views.find((v) => v.id === view)
  const scale = Math.max(minScale, Math.ceil(Math.max(...bars.map((b) => b.hours))))
  const total = formatHours(i18n, bars.reduce((sum, b) => sum + b.hours, 0))
  const value = (bar) => (bar.future ? t`upcoming` : formatHours(i18n, bar.hours))
  const activeBar = active !== null ? bars[active] : null
  const readout = activeBar ? `${activeBar.name}: ${value(activeBar)}` : t`${total} this month`

  const switchView = (id) => {
    setView(id)
    setActive(null)
  }

  const handleKeyDown = (e) => {
    const last = bars.length - 1
    const current = active ?? -1
    const target = { ArrowRight: Math.min(current + 1, last), ArrowLeft: Math.max(current - 1, 0), Home: 0, End: last }[e.key]
    if (target === undefined) return
    e.preventDefault()
    setActive(target)
  }

  const monthName = i18n.date(now, { month: 'long', year: 'numeric' })

  return (
    <section aria-labelledby={headingId} className={`${ui.card} flex flex-col gap-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="text-lg font-semibold">
            {view === 'days' ? <Trans>Hours per day</Trans> : <Trans>Hours per week</Trans>}
          </h2>
          <p id={readoutId} aria-live="polite" className="text-sm text-muted">{readout}</p>
        </div>
        <div role="group" aria-label={t`Chart view`} className="flex gap-0.5 rounded-lg bg-paper p-0.5">
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => switchView(v.id)}
              className={`min-h-[2.75rem] rounded-md px-3.5 text-sm ${
                view === v.id ? 'bg-surface font-semibold text-ink shadow-xs' : 'text-muted hover:text-ink'
              }`}
            >
              {i18n._(v.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <div aria-hidden="true" className="flex h-44 flex-col justify-between pb-0 text-right font-mono text-xs text-muted">
          <span>{i18n.number(scale)}</span>
          <span>{i18n.number(scale / 2)}</span>
          <span>{i18n.number(0)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div
            role="group"
            tabIndex={0}
            aria-label={t`Bars, use the arrow keys to read the values`}
            aria-describedby={readoutId}
            onKeyDown={handleKeyDown}
            onBlur={() => setActive(null)}
            onMouseLeave={() => setActive(null)}
            className="relative flex h-44 items-end gap-px border-b border-line-strong"
          >
            <span aria-hidden="true" className="absolute inset-x-0 top-0 border-t border-line-soft" />
            <span aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t border-line-soft" />
            {bars.map((bar, index) => (
              <div
                key={index}
                onMouseEnter={() => setActive(index)}
                className="relative flex h-full flex-1 items-end justify-center"
              >
                <div
                  className={`w-[62%] rounded-t-xs ${index === active ? 'bg-accent-dark' : 'bg-accent'} ${
                    index === active ? 'outline outline-2 outline-offset-1 outline-ink' : ''
                  }`}
                  style={{ height: `${(bar.hours / scale) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div aria-hidden="true" className="mt-1.5 flex gap-px">
            {bars.map((bar, index) => (
              <div key={index} className="min-w-0 flex-1 text-center text-xs leading-tight">
                <span className={bar.current ? 'font-semibold text-ink' : 'text-muted'}>{bar.label}</span>
                {bar.sub && <span className="block truncate text-muted">{bar.sub}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>{view === 'days' ? t`Hours per day, ${monthName}` : t`Hours per week, ${monthName}`}</caption>
        <thead>
          <tr>
            <th scope="col">{view === 'days' ? t`Day` : t`Week`}</th>
            <th scope="col">{t`Hours`}</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar, index) => (
            <tr key={index}>
              <th scope="row">{bar.name}</th>
              <td>{value(bar)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default HoursChart
