import { msg } from '@lingui/core/macro'
import { matchPath } from 'react-router'

// The pages and their addresses, in the order of the main navigation. `path` is where the navigation link goes,
// `pattern` all addresses of the page (optional segments hold the selected customer, project and month).
// App renders the routes and the navigation from this list; any other address shows the not-found page.
// No path may start with /api or /health: nginx sends those to the backend (tests/routes.test.js).
export const pages = [
  { id: 'dashboard', path: '/', pattern: '/', label: msg`Dashboard` },
  { id: 'time-tracking', path: '/time-tracking', pattern: '/time-tracking/:customerId?/:projectId?', label: msg`Time tracking` },
  { id: 'entries', path: '/entries', pattern: '/entries', label: msg`Entries` },
  { id: 'reports', path: '/reports', pattern: '/reports/:customerId?/:yearMonth?', label: msg`Reports` },
]

// The page an address belongs to (a trailing slash is the same address), or undefined. A month that is none
// (/reports/3/foo) belongs to no page.
export function pageFor(pathname) {
  for (const page of pages) {
    const match = matchPath({ path: page.pattern, end: true }, pathname)
    if (match) return match.params.yearMonth && !periodFromParam(match.params.yearMonth) ? undefined : page
  }
}

// Addresses with a selection: /time-tracking/:customerId/:projectId and /reports/:customerId/:yearMonth (2026-09)
export const trackingPath = (customerId, projectId) =>
  `/time-tracking${customerId ? `/${customerId}${projectId ? `/${projectId}` : ''}` : ''}`

export const reportPath = (customerId, year, month) =>
  `/reports${customerId ? `/${customerId}${year && month ? `/${year}-${String(month).padStart(2, '0')}` : ''}` : ''}`

// A record id from the address: a whole number, or null when missing or not one
export const idFromParam = (param) => (/^[1-9]\d*$/.test(param ?? '') ? Number(param) : null)

// { year, month } from "2026-09", or null when it is not a month
export function periodFromParam(param) {
  const match = /^([1-9]\d{3})-(0[1-9]|1[0-2])$/.exec(param ?? '')
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null
}
