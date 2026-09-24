import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { api, ApiError, fileNameFrom } from './api'

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
    expect(fetch.mock.calls[0][1]).toEqual({ method: 'GET' })
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
    expect(fileNameFrom(header)).toBe(name)
  })

  test('builds the URL of the PDF preview', () => {
    expect(api.pdfPreviewUrl(1, 9, 2026, 'de')).toMatch(/\/reports\/customer\/1\/pdf\?month=9&year=2026&lang=de&tz=Europe%2FBerlin&inline=1$/)
  })

  test('asks for a monthly report in the browser\'s time zone', async () => {
    const fetch = mockFetch(200, {})
    await api.getMonthlyReport(1, 9, 2026)

    expect(fetch.mock.calls[0][0]).toMatch(/\/reports\/customer\/1\?month=9&year=2026&tz=Europe%2FBerlin$/)
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
