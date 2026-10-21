import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { api, ApiError, fileNameFrom, onSessionEnded } from '@/api'

function mockFetch(status, body) {
  const fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'Status text',
    json: () => (body === undefined ? Promise.reject(new SyntaxError('no body')) : Promise.resolve(body)),
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

beforeEach(() => {
  // The browser's time zone, sent with reports and the dashboard
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone: 'Europe/Berlin' })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  onSessionEnded(() => {})
})

describe('api', () => {
  test('returns the parsed JSON on success', async () => {
    mockFetch(200, [{ id: 1, name: 'Kunde' }])
    await expect(api.getCustomers()).resolves.toEqual([{ id: 1, name: 'Kunde' }])
  })

  test('sends method, JSON header and body', async () => {
    const fetch = mockFetch(201, { id: 5 })
    await api.createTimeEntry(3, '2026-09-21T08:00:00Z', 'Konzept')

    const [url, options] = fetch.mock.calls[0]
    expect(url).toMatch(/\/time-entries$/)
    expect(options.method).toBe('POST')
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(options.body)).toEqual({ projectId: 3, startTime: '2026-09-21T08:00:00Z', description: 'Konzept' })
  })

  test('sends GET requests without a body', async () => {
    const fetch = mockFetch(200, [])
    await api.getCustomerTimeEntries(3)
    expect(fetch.mock.calls[0][0]).toMatch(/\/time-entries\/customer\/3$/)
    expect(fetch.mock.calls[0][1]).toEqual({ credentials: 'include', method: 'GET' })
  })

  test('asks for the running entry', async () => {
    const fetch = mockFetch(200, null)
    await expect(api.getActiveEntry()).resolves.toBeNull()
    expect(fetch.mock.calls[0][0]).toMatch(/\/time-entries\/active$/)
  })

  test.each([
    ['updateCustomer', [1, 'Neu', 'a@b.de'], '/customers/1', 'PUT', { name: 'Neu', email: 'a@b.de' }],
    ['deleteCustomer', [1], '/customers/1', 'DELETE', undefined],
    ['updateProject', [3, 'Web', 80], '/projects/3', 'PUT', { name: 'Web', hourlyRate: 80 }],
    ['deleteProject', [3], '/projects/3', 'DELETE', undefined],
    ['updateTimeEntry', [5, { endTime: 'e', startTime: 's' }], '/time-entries/5', 'PATCH', { endTime: 'e', startTime: 's' }],
    ['deleteTimeEntry', [5], '/time-entries/5', 'DELETE', undefined],
    ['createTimeEntry', [7, 's', 'Konzept', 'e'], '/time-entries', 'POST', { projectId: 7, startTime: 's', description: 'Konzept', endTime: 'e' }],
    ['setReportStatus', [1, 8, 2026, 'sent'], '/reports/customer/1/status', 'PUT', { month: 8, year: 2026, status: 'sent' }],
  ])('%s calls %s', async (name, args, path, method, body) => {
    const fetch = mockFetch(200, { id: 1 })
    await api[name](...args)

    const [url, options] = fetch.mock.calls[0]
    expect(url.endsWith(path)).toBe(true)
    expect(options.method).toBe(method)
    expect(options.body && JSON.parse(options.body)).toEqual(body)
  })

  test('loads the PDF in the given language and saves it under the backend\'s file name', async () => {
    const blob = new Blob(['%PDF-'])
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Disposition': `attachment; filename="abrechnung-?ód?-2026-9.pdf"; filename*=UTF-8''abrechnung-%C5%81%C3%B3d%C5%BA-2026-9.pdf` }),
      blob: () => Promise.resolve(blob),
    })
    vi.stubGlobal('fetch', fetch)
    URL.createObjectURL = vi.fn(() => 'blob:pdf')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const append = vi.spyOn(document.body, 'appendChild')

    await api.downloadPDF(1, 9, 2026, 'en')

    expect(fetch.mock.calls[0][0]).toMatch(/\/reports\/customer\/1\/pdf\?month=9&year=2026&lang=en&tz=Europe%2FBerlin$/)
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(append.mock.calls[0][0].download).toBe('abrechnung-Łódź-2026-9.pdf')
    expect(click).toHaveBeenCalled()
  })

  test('throws an ApiError instead of downloading when the PDF fails', async () => {
    mockFetch(404, { error: 'No time entries found for the specified month' })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const error = await api.downloadPDF(1, 9, 2026, 'en').catch((err) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(404)
    expect(click).not.toHaveBeenCalled()
  })

  test.each([
    [`attachment; filename="a-?.pdf"; filename*=UTF-8''a-%C5%81.pdf`, 'a-Ł.pdf'],
    ['attachment; filename="Caf\u00e9 \\"Post\\".pdf"', 'Caf\u00e9 "Post".pdf'],
    [null, 'report.pdf'],
  ])('reads the file name from %p', (header, name) => {
    expect(fileNameFrom(header, 'report.pdf')).toBe(name)
  })

  test('uses the given fallback when the header has no file name', () => {
    expect(fileNameFrom('attachment', 'report.csv')).toBe('report.csv')
  })

  test('loads the CSV in the given language and the browser\'s time zone and saves it under the backend\'s file name', async () => {
    const blob = new Blob(['﻿Date,Start'])
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Disposition': `attachment; filename="time-report-?ód?-2026-9.csv"; filename*=UTF-8''time-report-%C5%81%C3%B3d%C5%BA-2026-9.csv` }),
      blob: () => Promise.resolve(blob),
    })
    vi.stubGlobal('fetch', fetch)
    URL.createObjectURL = vi.fn(() => 'blob:csv')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const append = vi.spyOn(document.body, 'appendChild')

    await api.downloadCSV(1, 9, 2026, 'en')

    expect(fetch.mock.calls[0][0]).toMatch(/\/reports\/customer\/1\/csv\?month=9&year=2026&lang=en&tz=Europe%2FBerlin$/)
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(append.mock.calls[0][0].download).toBe('time-report-Łódź-2026-9.csv')
    expect(click).toHaveBeenCalled()
  })

  test('saves the CSV as report.csv when the backend sends no file name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers(), blob: async () => new Blob() }))
    URL.createObjectURL = vi.fn(() => 'blob:csv')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const append = vi.spyOn(document.body, 'appendChild')

    await api.downloadCSV(1, 9, 2026, 'de')

    expect(append.mock.calls[0][0].download).toBe('report.csv')
  })

  test('throws an ApiError instead of downloading when the CSV fails', async () => {
    mockFetch(404, { error: 'No time entries found for the specified month' })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const error = await api.downloadCSV(1, 9, 2026, 'en').catch((err) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(404)
    expect(click).not.toHaveBeenCalled()
  })

  test('builds the URL of the PDF preview', () => {
    expect(api.pdfPreviewUrl(1, 9, 2026, 'de')).toMatch(/\/reports\/customer\/1\/pdf\?month=9&year=2026&lang=de&tz=Europe%2FBerlin&inline=1$/)
  })

  test('asks for a monthly report in the browser\'s time zone', async () => {
    const fetch = mockFetch(200, {})
    await api.getMonthlyReport(1, 9, 2026)

    expect(fetch.mock.calls[0][0]).toMatch(/\/reports\/customer\/1\?month=9&year=2026&tz=Europe%2FBerlin$/)
  })

  test('searches the entries with the filters, the page and the browser\'s time zone', async () => {
    const fetch = mockFetch(200, { entries: [], total: 0, hours: 0 })
    await api.searchTimeEntries(
      { q: 'a&b 100%', customerId: '2', projectId: '5', from: '2026-09-01', to: '2026-09-30', sort: 'oldest' },
      { limit: 50, offset: 100 }
    )

    expect(fetch.mock.calls[0][0]).toMatch(
      /\/time-entries\/search\?q=a%26b%20100%25&customerId=2&projectId=5&from=2026-09-01&to=2026-09-30&sort=oldest&limit=50&offset=100&tz=Europe%2FBerlin$/
    )
  })

  test('leaves empty filters out of the search, but keeps an offset of 0', async () => {
    const fetch = mockFetch(200, {})
    await api.searchTimeEntries({ q: '', customerId: undefined, projectId: null, sort: 'newest' }, { limit: 50, offset: 0 })

    expect(fetch.mock.calls[0][0]).toMatch(/\/time-entries\/search\?sort=newest&limit=50&offset=0&tz=Europe%2FBerlin$/)
  })

  test('asks for the dashboard of a range and month', async () => {
    const fetch = mockFetch(200, {})
    await api.getDashboard('2026-08-31T22:00:00.000Z', '2026-09-30T22:00:00.000Z', 9, 2026)

    expect(fetch.mock.calls[0][0]).toMatch(
      /\/dashboard\?from=2026-08-31T22%3A00%3A00\.000Z&to=2026-09-30T22%3A00%3A00\.000Z&month=9&year=2026&tz=Europe%2FBerlin$/
    )
  })

  test('throws an ApiError with status and backend message on error responses', async () => {
    mockFetch(400, { error: 'projectId and startTime are required' })
    const error = await api.createTimeEntry().catch((err) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(400)
    expect(error.message).toBe('projectId and startTime are required')
  })

  test('falls back to the status text when the error response has no JSON body', async () => {
    mockFetch(502)
    const error = await api.getCustomers().catch((err) => err)

    expect(error.status).toBe(502)
    expect(error.message).toBe('Status text')
  })

  test('throws an ApiError with status 0 when the server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const error = await api.getCustomers().catch((err) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
  })
})

describe('login', () => {
  test.each([
    ['getCustomers', []],
    ['createCustomer', ['Kunde', 'a@b.de']],
    ['deleteProject', [3]],
    ['getDashboard', ['f', 't', 9, 2026]],
    ['downloadPDF', [1, 9, 2026, 'de']],
    ['downloadCSV', [1, 9, 2026, 'de']],
  ])('%s sends the login cookie', async (name, args) => {
    const fetch = mockFetch(200, {})
    if (name.startsWith('download')) {
      fetch.mockResolvedValue({ ok: true, status: 200, blob: async () => new Blob(), headers: { get: () => null } })
      vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })
    }
    await api[name](...args)

    expect(fetch.mock.calls[0][1].credentials).toBe('include')
  })

  test('sends email and password as JSON', async () => {
    const fetch = mockFetch(200, { email: 'me@example.com' })

    await expect(api.login('me@example.com', 'Secret-1!')).resolves.toEqual({ email: 'me@example.com' })

    const [url, options] = fetch.mock.calls[0]
    expect(url).toMatch(/\/auth\/login$/)
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ email: 'me@example.com', password: 'Secret-1!' })
  })

  test('logs out with a POST', async () => {
    const fetch = mockFetch(204)
    await api.logout()

    expect(fetch.mock.calls[0][0]).toMatch(/\/auth\/logout$/)
    expect(fetch.mock.calls[0][1].method).toBe('POST')
  })

  test('asks who is logged in', async () => {
    const fetch = mockFetch(200, { email: 'me@example.com' })

    await expect(api.getSession()).resolves.toEqual({ email: 'me@example.com' })
    expect(fetch.mock.calls[0][0]).toMatch(/\/auth\/me$/)
  })

  test('answers null when nobody is logged in, without ending a session', async () => {
    mockFetch(401, { error: 'Not logged in' })
    const ended = vi.fn()
    onSessionEnded(ended)

    await expect(api.getSession()).resolves.toBeNull()
    expect(ended).not.toHaveBeenCalled()
  })

  test.each([[0], [500]])('still throws when asking who is logged in fails with status %i', async (status) => {
    if (status === 0) vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')))
    else mockFetch(status, { error: 'Failed' })

    const error = await api.getSession().catch((err) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(status)
  })

  test('a wrong password throws the 401 without ending a session', async () => {
    mockFetch(401, { error: 'Wrong email or password' })
    const ended = vi.fn()
    onSessionEnded(ended)

    const error = await api.login('me@example.com', 'wrong').catch((err) => err)

    expect(error.status).toBe(401)
    expect(ended).not.toHaveBeenCalled()
  })

  test('a logout answered with 401 counts as logged out', async () => {
    mockFetch(401, { error: 'Not logged in' })

    await expect(api.logout()).resolves.toBeNull()
  })

  test.each([[0], [500]])('a logout that fails with status %i throws', async (status) => {
    if (status === 0) vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')))
    else mockFetch(status, { error: 'Failed' })

    const error = await api.logout().catch((err) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(status)
  })

  test('a failed logout does not end the session either', async () => {
    mockFetch(401, { error: 'Not logged in' })
    const ended = vi.fn()
    onSessionEnded(ended)

    await api.logout().catch(() => {})

    expect(ended).not.toHaveBeenCalled()
  })

  test.each([
    ['getCustomers', []],
    ['createCustomer', ['Kunde']],
    ['getDashboard', ['f', 't', 9, 2026]],
    ['downloadPDF', [1, 9, 2026, 'de']],
    ['downloadCSV', [1, 9, 2026, 'de']],
  ])('a 401 from %s says the session has ended and still throws', async (name, args) => {
    mockFetch(401, { error: 'Not logged in' })
    const ended = vi.fn()
    onSessionEnded(ended)

    const error = await api[name](...args).catch((err) => err)

    expect(ended).toHaveBeenCalledTimes(1)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(401)
  })

  test.each([403, 404, 500])('a %i does not end the session', async (status) => {
    mockFetch(status, { error: 'Failed' })
    const ended = vi.fn()
    onSessionEnded(ended)

    await api.getCustomers().catch(() => {})

    expect(ended).not.toHaveBeenCalled()
  })

  test('a 401 with no JSON body still ends the session', async () => {
    mockFetch(401)
    const ended = vi.fn()
    onSessionEnded(ended)

    const error = await api.getCustomers().catch((err) => err)

    expect(ended).toHaveBeenCalledTimes(1)
    expect(error.status).toBe(401)
  })

  test('an unreachable server does not end the session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')))
    const ended = vi.fn()
    onSessionEnded(ended)

    await api.getCustomers().catch(() => {})

    expect(ended).not.toHaveBeenCalled()
  })

  test('a handler that was replaced is not called any more', async () => {
    mockFetch(401, {})
    const first = vi.fn()
    const second = vi.fn()
    onSessionEnded(first)
    onSessionEnded(second)

    await api.getCustomers().catch(() => {})

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  test('the login keeps the cookie setting and the JSON header', async () => {
    const fetch = mockFetch(200, { email: 'me@example.com' })
    await api.login('me@example.com', 'x')

    expect(fetch.mock.calls[0][1].credentials).toBe('include')
    expect(fetch.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' })
  })

  test('the logout and the session check send the cookie too', async () => {
    const fetch = mockFetch(200, {})
    await api.logout()
    await api.getSession()

    expect(fetch.mock.calls.map(([, options]) => options.credentials)).toEqual(['include', 'include'])
  })
})
