import { describe, expect, test } from 'vitest'
import { idFromParam, pageFor, pages, periodFromParam, reportPath, trackingPath } from '@/routes'

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
    expect(pageFor('/reports/1/2026-09/x')).toBeUndefined()
    expect(pageFor('/entries/1')).toBeUndefined()
    expect(pageFor('/time-tracking/1/2/3')).toBeUndefined()
    expect(pageFor('/time-trackingx')).toBeUndefined()
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

  test('pageFor finds the page for an address with a selection, also with a trailing slash', () => {
    expect(pageFor('/reports/1')?.id).toBe('reports')
    expect(pageFor('/reports/1/2026-09')?.id).toBe('reports')
    expect(pageFor('/reports/1/2026-09/')?.id).toBe('reports')
    expect(pageFor('/time-tracking/1')?.id).toBe('time-tracking')
    expect(pageFor('/time-tracking/1/2')?.id).toBe('time-tracking')
  })

  test('pageFor finds no page for a month that is none', () => {
    expect(pageFor('/reports/1/foo')).toBeUndefined()
    expect(pageFor('/reports/1/2026-13')).toBeUndefined()
  })

  test('trackingPath builds the address of a customer and project', () => {
    expect(trackingPath()).toBe('/time-tracking')
    expect(trackingPath(null, 5)).toBe('/time-tracking')
    expect(trackingPath(3)).toBe('/time-tracking/3')
    expect(trackingPath(3, null)).toBe('/time-tracking/3')
    expect(trackingPath(3, 5)).toBe('/time-tracking/3/5')
  })

  test('reportPath builds the address of a customer and month, with the month padded', () => {
    expect(reportPath()).toBe('/reports')
    expect(reportPath(null, 2026, 9)).toBe('/reports')
    expect(reportPath(3)).toBe('/reports/3')
    expect(reportPath(3, 2026, 9)).toBe('/reports/3/2026-09')
    expect(reportPath(3, 2026, 12)).toBe('/reports/3/2026-12')
    expect(reportPath(3, 2026)).toBe('/reports/3')
  })

  test.each([['7', 7], ['12', 12], ['0', null], ['07', null], ['-1', null], ['1.5', null], ['abc', null], ['', null], [undefined, null]])(
    'idFromParam(%j) is %j', (param, id) => {
      expect(idFromParam(param)).toBe(id)
    })

  test.each([['2026-09', { year: 2026, month: 9 }], ['1999-12', { year: 1999, month: 12 }], ['2026-9', null], ['2026-00', null],
    ['2026-13', null], ['26-09', null], ['0050-03', null], ['0999-12', null], ['2026-09-01', null], ['', null], [undefined, null]])('periodFromParam(%j)', (param, period) => {
    expect(periodFromParam(param)).toEqual(period)
  })
})
