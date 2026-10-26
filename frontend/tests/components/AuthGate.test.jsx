import { beforeEach, describe, expect, it, test, vi } from 'vitest'
import { act, renderWithRouter as render, screen } from '../support/render'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router'
import AuthGate from '@/components/AuthGate'
import { api, ApiError } from '@/api'

vi.mock('@/api', async (importOriginal) => {
  const original = await importOriginal()
  // Keeps the real session-ended handler, so the tests can trigger it like api.js does
  return { ...original, api: { getSession: vi.fn(), login: vi.fn(), logout: vi.fn() } }
})
// The app has its own tests; here it only has to show what the gate gives it
vi.mock('@/App', () => ({
  default: ({ onLogout, logoutError, focusOnStart }) => (
    <main>
      <p>App is shown</p>
      <p>{focusOnStart ? 'focus after login' : 'no focus move'}</p>
      <button onClick={onLogout}>App logout</button>
      {logoutError && <p role="alert">{logoutError}</p>}
    </main>
  ),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

async function loginAs(email = 'me@example.com') {
  api.login.mockResolvedValue({ email })
  await userEvent.type(await screen.findByLabelText('E-Mail'), email)
  await userEvent.type(screen.getByLabelText('Passwort'), 'Correct-Horse-1')
  await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }))
}

// A 401 for a request of the app, the way api.js reports it
async function endSession() {
  await act(async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }))
    const { api: real } = await vi.importActual('@/api')
    await real.getCustomers().catch(() => {})
    vi.unstubAllGlobals()
  })
}

function Path() {
  return <p data-testid="path">{useLocation().pathname}</p>
}

describe('AuthGate addresses', () => {
  test('a deep link opened while logged out leads to the login and then to the same address', async () => {
    api.getSession.mockResolvedValue(null)
    render(<><AuthGate /><Path /></>, { route: '/reports' })

    expect(await screen.findByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent('/reports')
    expect(document.title).toBe('Anmelden · Time Tracking')

    await loginAs()

    expect(await screen.findByText('App is shown')).toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent('/reports')
  })

  test('a deliberate logout resets the address to the Dashboard', async () => {
    api.getSession.mockResolvedValue({ email: 'me@example.com' })
    api.logout.mockResolvedValue(null)
    render(<><AuthGate /><Path /></>, { route: '/reports' })

    await userEvent.click(await screen.findByRole('button', { name: 'App logout' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/$/)
  })

  test('a failed logout keeps the address', async () => {
    api.getSession.mockResolvedValue({ email: 'me@example.com' })
    api.logout.mockRejectedValue(new ApiError(0, 'Server not reachable'))
    render(<><AuthGate /><Path /></>, { route: '/entries' })

    await userEvent.click(await screen.findByRole('button', { name: 'App logout' }))
    await screen.findByRole('alert')

    expect(screen.getByTestId('path')).toHaveTextContent('/entries')
  })

  test('a session that ends keeps the address, so the next login returns to the page', async () => {
    api.getSession.mockResolvedValue({ email: 'me@example.com' })
    render(<><AuthGate /><Path /></>, { route: '/entries' })
    await screen.findByText('App is shown')

    await endSession()
    await screen.findByRole('heading', { level: 1, name: 'Anmelden' })
    expect(screen.getByTestId('path')).toHaveTextContent('/entries')

    await loginAs()
    await screen.findByText('App is shown')
    expect(screen.getByTestId('path')).toHaveTextContent('/entries')
  })
})

describe('AuthGate', () => {
  test('shows a loading text while the session is checked, and no app', () => {
    api.getSession.mockReturnValue(new Promise(() => {}))
    render(<AuthGate />)

    expect(screen.getByText('Laden...')).toBeInTheDocument()
    expect(screen.queryByText('App is shown')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Passwort')).not.toBeInTheDocument()
  })

  test('shows the app when a session exists', async () => {
    api.getSession.mockResolvedValue({ email: 'me@example.com' })
    render(<AuthGate />)

    expect(await screen.findByText('App is shown')).toBeInTheDocument()
    expect(screen.queryByLabelText('Passwort')).not.toBeInTheDocument()
  })

  test('asks the app to take focus after a login, but not when a session already exists', async () => {
    api.getSession.mockResolvedValueOnce({ email: 'me@example.com' })
    const first = render(<AuthGate />)
    expect(await screen.findByText('no focus move')).toBeInTheDocument()
    first.unmount()

    api.getSession.mockResolvedValueOnce(null)
    render(<AuthGate />)
    await loginAs()

    expect(await screen.findByText('focus after login')).toBeInTheDocument()
  })

  test('asks for the focus move again when the user logs in after a logout', async () => {
    api.getSession.mockResolvedValue({ email: 'me@example.com' })
    api.logout.mockResolvedValue(null)
    render(<AuthGate />)
    await userEvent.click(await screen.findByRole('button', { name: 'App logout' }))
    await screen.findByRole('heading', { level: 1, name: 'Anmelden' })

    await loginAs()

    expect(await screen.findByText('focus after login')).toBeInTheDocument()
  })

  test('shows the login page, and not the app, when nobody is logged in', async () => {
    api.getSession.mockResolvedValue(null)
    render(<AuthGate />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument()
    expect(screen.queryByText('App is shown')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('shows the app after logging in', async () => {
    api.getSession.mockResolvedValue(null)
    render(<AuthGate />)

    await loginAs()

    expect(await screen.findByText('App is shown')).toBeInTheDocument()
  })

  test('says so and offers to retry when the server is not reachable', async () => {
    api.getSession.mockRejectedValueOnce(new ApiError(0, 'Server not reachable'))
    api.getSession.mockResolvedValueOnce({ email: 'me@example.com' })
    render(<AuthGate />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Der Anmeldestatus konnte nicht geprüft werden. Der Server ist nicht erreichbar.')
    expect(screen.queryByText('App is shown')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))

    expect(await screen.findByText('App is shown')).toBeInTheDocument()
  })

  test('logs out: ends the session and shows the login page without the old notice', async () => {
    api.getSession.mockResolvedValue({ email: 'me@example.com' })
    api.logout.mockResolvedValue(null)
    render(<AuthGate />)

    await userEvent.click(await screen.findByRole('button', { name: 'App logout' }))

    expect(api.logout).toHaveBeenCalled()
    expect(await screen.findByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument()
    expect(screen.queryByText('App is shown')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('stays logged in and shows the error when logging out fails', async () => {
    api.getSession.mockResolvedValue({ email: 'me@example.com' })
    api.logout.mockRejectedValue(new ApiError(0, 'Server not reachable'))
    render(<AuthGate />)

    await userEvent.click(await screen.findByRole('button', { name: 'App logout' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Abmelden fehlgeschlagen.')
    expect(screen.getByText('App is shown')).toBeInTheDocument()
  })

  test('replaces the app with the login page and a notice when a request finds the session ended', async () => {
    api.getSession.mockResolvedValue({ email: 'me@example.com' })
    render(<AuthGate />)
    await screen.findByText('App is shown')

    // api.js calls this handler on a 401 of any request but the login
    await act(async () => {
      // The registered handler is module state, reached through a request the way the app does
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }))
      const { api: real } = await vi.importActual('@/api')
      await real.getCustomers().catch(() => {})
      vi.unstubAllGlobals()
    })

    expect(await screen.findByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Deine Sitzung ist abgelaufen')
    expect(screen.queryByText('App is shown')).not.toBeInTheDocument()
  })

  test('forgets the notice after the next login', async () => {
    api.getSession.mockResolvedValue({ email: 'me@example.com' })
    render(<AuthGate />)
    await screen.findByText('App is shown')
    await act(async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }))
      const { api: real } = await vi.importActual('@/api')
      await real.getCustomers().catch(() => {})
      vi.unstubAllGlobals()
    })
    await screen.findByRole('status')

    await loginAs()
    await screen.findByText('App is shown')
    api.logout.mockResolvedValue(null)
    await userEvent.click(screen.getByRole('button', { name: 'App logout' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('shows the login page once when several requests find the session ended', async () => {
    api.getSession.mockResolvedValue({ email: 'me@example.com' })
    render(<AuthGate />)
    await screen.findByText('App is shown')

    await endSession()
    await endSession()

    expect(await screen.findAllByRole('heading', { level: 1, name: 'Anmelden' })).toHaveLength(1)
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  test('does not react to a late 401 after the gate is gone', async () => {
    api.getSession.mockResolvedValue({ email: 'me@example.com' })
    const { unmount } = render(<AuthGate />)
    await screen.findByText('App is shown')
    unmount()

    await expect(endSession()).resolves.toBeUndefined()
    expect(console.error).not.toHaveBeenCalled()
  })

  test('shows the app again after logging in following an ended session', async () => {
    api.getSession.mockResolvedValue({ email: 'me@example.com' })
    render(<AuthGate />)
    await screen.findByText('App is shown')
    await endSession()
    await screen.findByRole('status')

    await loginAs()

    expect(await screen.findByText('App is shown')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('keeps the login page and its error when the check of the session fails with a server error', async () => {
    api.getSession.mockRejectedValue(new ApiError(500, 'Boom'))
    render(<AuthGate />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Der Anmeldestatus konnte nicht geprüft werden.')
    expect(screen.queryByLabelText('Passwort')).not.toBeInTheDocument()
  })

  it('shows no ended-session notice for a late 401 after a deliberate logout', async () => {
    api.getSession.mockResolvedValue({ email: 'me@example.com' })
    api.logout.mockResolvedValue(null)
    render(<AuthGate />)
    await userEvent.click(await screen.findByRole('button', { name: 'App logout' }))
    await screen.findByRole('heading', { level: 1, name: 'Anmelden' })

    await endSession()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
