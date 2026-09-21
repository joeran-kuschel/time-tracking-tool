import { afterEach, describe, expect, test, vi } from 'vitest'
import { api, ApiError } from './api'

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

afterEach(() => {
  vi.unstubAllGlobals()
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
    await api.getTimeEntries(3)
    expect(fetch.mock.calls[0][1]).toEqual({ method: 'GET' })
  })

  test('asks for the running entry', async () => {
    const fetch = mockFetch(200, null)
    await expect(api.getActiveEntry()).resolves.toBeNull()
    expect(fetch.mock.calls[0][0]).toMatch(/\/time-entries\/active$/)
  })

  test('asks for the PDF in the given language', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const append = vi.spyOn(document.body, 'appendChild')

    api.downloadPDF(1, 9, 2026, 'en')

    expect(append.mock.calls[0][0].href).toMatch(/\/reports\/customer\/1\/pdf\?month=9&year=2026&lang=en$/)
    expect(click).toHaveBeenCalled()
    vi.restoreAllMocks()
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
