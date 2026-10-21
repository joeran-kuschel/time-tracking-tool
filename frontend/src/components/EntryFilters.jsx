import { useId, useRef, useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { msg } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { isReversed, periodPreset, presets } from '../filters'
import { ui } from '../ui'

const presetLabels = {
  any: msg`Any time`,
  today: msg`Today`,
  thisWeek: msg`This week`,
  lastWeek: msg`Last week`,
  thisMonth: msg`This month`,
  lastMonth: msg`Last month`,
  thisYear: msg`This year`,
  custom: msg`Custom`,
}

const sortLabels = {
  newest: msg`Newest first`,
  oldest: msg`Oldest first`,
}

const chipButton = 'inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-sm hover:bg-paper'

// The filter form of the Entries page, which can be collapsed. Collapsed, the header row still shows the active
// filters as chips that remove themselves, and Reset.
// filters: see emptyFilters in filters.js. onChange(changes) merges changes into them; onSearch applies the search
// text at once (Enter); onReset clears all filters. customers and projects fill the selects; the project select
// belongs to the chosen customer.
function EntryFilters({ filters, customers, projects, onChange, onSearch, onReset }) {
  const { t, i18n } = useLingui()
  const [expanded, setExpanded] = useState(true)
  const search = useRef(null)
  const toggle = useRef(null)
  const panelId = useId()
  const headingId = useId()
  const rangeErrorId = useId()
  const fieldId = useId()
  const reversed = isReversed(filters)

  const day = (date) => i18n.date(new Date(`${date}T00:00`), { dateStyle: 'medium' })
  const customerName = customers.find((c) => String(c.id) === filters.customerId)?.name
  const projectName = projects.find((p) => String(p.id) === filters.projectId)?.name
  const periodName = filters.preset === 'custom'
    ? `${filters.from ? day(filters.from) : '…'} – ${filters.to ? day(filters.to) : '…'}`
    : i18n._(presetLabels[filters.preset])
  const sortName = i18n._(sortLabels[filters.sort])

  const query = filters.q.trim()

  // The active filters: a period or order other than the default counts, too
  const chips = [
    query && { key: 'q', label: t`Search: ${query}`, clear: { q: '' } },
    customerName && { key: 'customer', label: t`Customer: ${customerName}`, clear: { customerId: '', projectId: '' } },
    projectName && { key: 'project', label: t`Project: ${projectName}`, clear: { projectId: '' } },
    filters.preset !== 'any' && { key: 'period', label: t`Period: ${periodName}`, clear: { preset: 'any', from: '', to: '' } },
    filters.sort !== 'newest' && { key: 'sort', label: t`Sort: ${sortName}`, clear: { sort: 'newest' } },
  ].filter(Boolean)

  const changePreset = (preset) => onChange({ preset, ...periodPreset(preset, new Date()) })

  // The chip disappears with its filter, so focus moves to the toggle
  const removeChip = (clear) => {
    onChange(clear)
    toggle.current?.focus()
  }

  const reset = () => {
    onReset()
    // The reset button disappears with the filters, so focus moves on
    ;(expanded ? search : toggle).current?.focus()
  }

  const Icon = expanded ? ChevronUpIcon : ChevronDownIcon

  return (
    <form
      role="search"
      aria-label={t`Filter entries`}
      onSubmit={(e) => e.preventDefault()}
      className={`${ui.card} flex flex-col gap-4`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id={headingId} className="text-lg font-semibold">
          <button
            ref={toggle}
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded(!expanded)}
            className="-ml-2 inline-flex min-h-[2.75rem] items-center gap-2 rounded-lg px-2 hover:bg-paper"
          >
            <Trans>Filters</Trans>
            <Icon aria-hidden="true" className="h-4 w-4" />
          </button>
        </h2>
        {chips.length === 0 ? (
          <p className="text-sm text-muted"><Trans>No filters active</Trans></p>
        ) : (
          <>
            <p className="text-sm text-muted">
              <Plural value={chips.length} one="# filter active" other="# filters active" />
            </p>
            <ul aria-label={t`Active filters`} className="flex flex-wrap gap-2">
              {chips.map(({ key, label, clear }) => (
                <li key={key}>
                  <button type="button" aria-label={t`Remove filter: ${label}`} onClick={() => removeChip(clear)} className={chipButton}>
                    {label}
                    <XMarkIcon aria-hidden="true" className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={reset} className={`${ui.buttonSecondary} min-h-[2.75rem]`}>
              <Trans>Reset filters</Trans>
            </button>
          </>
        )}
      </div>

      <div id={panelId} hidden={!expanded} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <label htmlFor={`${fieldId}-q`} className={ui.label}><Trans>Search in descriptions</Trans></label>
          <input
            ref={search}
            id={`${fieldId}-q`}
            type="search"
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSearch() } }}
            className={ui.input}
          />
        </div>

        <div>
          <label htmlFor={`${fieldId}-customer`} className={ui.label}><Trans>Customer</Trans></label>
          <select
            id={`${fieldId}-customer`}
            value={filters.customerId}
            onChange={(e) => onChange({ customerId: e.target.value, projectId: '' })}
            className={ui.select}
          >
            <option value="">{t`All customers`}</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor={`${fieldId}-project`} className={ui.label}><Trans>Project</Trans></label>
          <select
            id={`${fieldId}-project`}
            value={filters.projectId}
            disabled={!filters.customerId}
            onChange={(e) => onChange({ projectId: e.target.value })}
            className={`${ui.select} disabled:opacity-60`}
          >
            <option value="">{t`All projects`}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor={`${fieldId}-sort`} className={ui.label}><Trans>Sort</Trans></label>
          <select id={`${fieldId}-sort`} value={filters.sort} onChange={(e) => onChange({ sort: e.target.value })} className={ui.select}>
            {Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{i18n._(label)}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor={`${fieldId}-period`} className={ui.label}><Trans>Period</Trans></label>
          <select
            id={`${fieldId}-period`}
            value={filters.preset}
            onChange={(e) => changePreset(e.target.value)}
            className={ui.select}
          >
            {presets.map((preset) => <option key={preset} value={preset}>{i18n._(presetLabels[preset])}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor={`${fieldId}-from`} className={ui.label}><Trans>From</Trans></label>
          <input
            id={`${fieldId}-from`}
            type="date"
            value={filters.from}
            onChange={(e) => onChange({ from: e.target.value, preset: 'custom' })}
            aria-invalid={reversed || undefined}
            aria-describedby={reversed ? rangeErrorId : undefined}
            className={ui.input}
          />
        </div>

        <div>
          <label htmlFor={`${fieldId}-to`} className={ui.label}><Trans>To</Trans></label>
          <input
            id={`${fieldId}-to`}
            type="date"
            value={filters.to}
            onChange={(e) => onChange({ to: e.target.value, preset: 'custom' })}
            aria-invalid={reversed || undefined}
            aria-describedby={reversed ? rangeErrorId : undefined}
            className={ui.input}
          />
        </div>

        {reversed && (
          <p id={rangeErrorId} className="text-sm text-danger sm:col-span-2 lg:col-span-3">
            <Trans>The end date must not be before the start date</Trans>
          </p>
        )}
      </div>
    </form>
  )
}

export default EntryFilters
