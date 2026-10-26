import { msg } from '@lingui/core/macro'
import { matchPath } from 'react-router'

// The pages and their addresses, in the order of the main navigation. App renders the routes and the
// navigation from this list; any other address shows the not-found page.
// No path may start with /api or /health: nginx sends those to the backend (tests/routes.test.js).
export const pages = [
  { id: 'dashboard', path: '/', label: msg`Dashboard` },
  { id: 'time-tracking', path: '/time-tracking', label: msg`Time tracking` },
  { id: 'entries', path: '/entries', label: msg`Entries` },
  { id: 'reports', path: '/reports', label: msg`Reports` },
]

// The page an address belongs to (a trailing slash is the same address), or undefined
export const pageFor = (pathname) => pages.find(({ path }) => matchPath({ path, end: true }, pathname))
