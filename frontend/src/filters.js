import { addDays, startOfWeek } from './dashboard'
import { toDateInput } from './entryTime'

// The filters of the Entries page. Ids are strings (the values of the selects); from and to are local dates
// (YYYY-MM-DD); preset says which period choice the dates came from.
export const emptyFilters = { q: '', customerId: '', projectId: '', preset: 'any', from: '', to: '', sort: 'newest' }

export const presets = ['any', 'today', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'thisYear', 'custom']

// The dates of a period choice relative to now (weeks start on Monday), as local YYYY-MM-DD strings.
// 'any' has no dates; 'custom' keeps whatever the user typed, so it returns null.
export function periodPreset(preset, now) {
  const range = (from, to) => ({ from: toDateInput(from), to: toDateInput(to) })
  const year = now.getFullYear()
  const month = now.getMonth()
  switch (preset) {
    case 'any': return { from: '', to: '' }
    case 'today': return range(now, now)
    case 'thisWeek': return range(startOfWeek(now), addDays(startOfWeek(now), 6))
    case 'lastWeek': return range(addDays(startOfWeek(now), -7), addDays(startOfWeek(now), -1))
    case 'thisMonth': return range(new Date(year, month, 1), new Date(year, month + 1, 0))
    case 'lastMonth': return range(new Date(year, month - 1, 1), new Date(year, month, 0))
    case 'thisYear': return range(new Date(year, 0, 1), new Date(year, 11, 31))
    default: return null
  }
}

// What the page opens with: the current month
export const openingFilters = (now) => ({ ...emptyFilters, preset: 'thisMonth', ...periodPreset('thisMonth', now) })

// The search parameters of the filters: no empty values, the search text trimmed
export function toQuery({ q, customerId, projectId, from, to, sort }) {
  const query = { q: q.trim(), customerId, projectId, from, to, sort }
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== ''))
}

// Whether the period ends before it starts (the backend answers 400 then)
export const isReversed = ({ from, to }) => Boolean(from && to && from > to)
