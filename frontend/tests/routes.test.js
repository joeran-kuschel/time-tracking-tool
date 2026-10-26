import { describe, expect, test } from 'vitest'
import { pageFor, pages } from '@/routes'

describe('routes', () => {
  test('lists the pages with their addresses, in the order of the navigation', () => {
    expect(pages.map(({ id, path }) => [id, path])).toEqual([
      ['dashboard', '/'],
      ['time-tracking', '/time-tracking'],
      ['entries', '/entries'],
      ['reports', '/reports'],
    ])
  })

  test('has unique ids and paths', () => {
    expect(new Set(pages.map((page) => page.id)).size).toBe(pages.length)
    expect(new Set(pages.map((page) => page.path)).size).toBe(pages.length)
  })

  // nginx sends these to the backend, so a page there would never be reachable by a reload
  test.each(['/api', '/health'])('no page path starts with %s', (reserved) => {
    for (const { path } of pages) expect(path.startsWith(reserved)).toBe(false)
  })

  test('every path is absolute', () => {
    for (const { path } of pages) expect(path.startsWith('/')).toBe(true)
  })

  test('pageFor finds a page, also with a trailing slash', () => {
    expect(pageFor('/')?.id).toBe('dashboard')
    expect(pageFor('/reports')?.id).toBe('reports')
    expect(pageFor('/reports/')?.id).toBe('reports')
  })

  test('pageFor finds nothing for other addresses', () => {
    expect(pageFor('/reports/1')).toBeUndefined()
    expect(pageFor('/api/customers')).toBeUndefined()
    expect(pageFor('/unknown')).toBeUndefined()
  })

  test('pageFor ignores the case of the letters and accepts a trailing slash on every page', () => {
    expect(pageFor('/Reports')?.id).toBe('reports')
    expect(pageFor('/TIME-TRACKING/')?.id).toBe('time-tracking')
  })

  // nginx decides on the raw path, so the table must not match these as pages either
  test.each(['/api', '/api/', '/API/customers', '/%61pi', '/health', '/health/', '/index.html', '/assets/x.js'])(
    'pageFor finds no page for %s', (address) => {
      expect(pageFor(address)).toBeUndefined()
    })

  test('pageFor finds no page for a nested address, as long as selections are not in the address', () => {
    expect(pageFor('/reports/1/2026-09')).toBeUndefined()
    expect(pageFor('/time-tracking/1/2')).toBeUndefined()
  })
})
