import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, within } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import Login from '@/pages/Login'
import { api, ApiError } from '@/api'
import { activateLocale } from '@/i18n'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { login: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

async function fillAndSubmit(email = 'me@example.com', password = 'Correct-Horse-1') {
  await userEvent.type(screen.getByLabelText('E-Mail'), email)
  await userEvent.type(screen.getByLabelText('Passwort'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }))
}

describe('Login', () => {
  test('has a heading, labeled fields that password managers recognize, and focus on the first field', () => {
    render(<Login onLogin={() => {}} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument()
    const email = screen.getByLabelText('E-Mail')
    const password = screen.getByLabelText('Passwort')
    expect(email).toHaveAttribute('type', 'email')
    expect(email).toHaveAttribute('autocomplete', 'username')
    expect(email).toBeRequired()
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveAttribute('autocomplete', 'current-password')
    expect(password).toBeRequired()
    expect(email).toHaveFocus()
  })

  test('sends the trimmed email and the password, then reports the user', async () => {
    api.login.mockResolvedValue({ email: 'me@example.com' })
    const onLogin = vi.fn()
    render(<Login onLogin={onLogin} />)

    await fillAndSubmit('  me@example.com ', ' Correct-Horse-1 ')

    expect(api.login).toHaveBeenCalledWith('me@example.com', ' Correct-Horse-1 ')
    expect(onLogin).toHaveBeenCalledWith({ email: 'me@example.com' })
  })

  test('allows pasting into the password field', async () => {
    api.login.mockResolvedValue({ email: 'me@example.com' })
    render(<Login onLogin={() => {}} />)

    await userEvent.type(screen.getByLabelText('E-Mail'), 'me@example.com')
    await userEvent.click(screen.getByLabelText('Passwort'))
    await userEvent.paste('Pasted-Password-1')
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(api.login).toHaveBeenCalledWith('me@example.com', 'Pasted-Password-1')
  })

  test('announces wrong credentials and keeps the page', async () => {
    api.login.mockRejectedValue(new ApiError(401, 'Wrong email or password'))
    const onLogin = vi.fn()
    render(<Login onLogin={onLogin} />)

    await fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Anmeldung fehlgeschlagen. Prüfe E-Mail und Passwort.')
    expect(onLogin).not.toHaveBeenCalled()
    expect(screen.getByLabelText('E-Mail')).toHaveValue('me@example.com')
  })

  test('tells the user to wait after too many failed logins', async () => {
    api.login.mockRejectedValue(new ApiError(429, 'Too many failed logins'))
    render(<Login onLogin={() => {}} />)

    await fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Zu viele fehlgeschlagene Versuche')
  })

  test('says when the server is not reachable', async () => {
    api.login.mockRejectedValue(new ApiError(0, 'Server not reachable'))
    render(<Login onLogin={() => {}} />)

    await fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Anmeldung fehlgeschlagen. Der Server ist nicht erreichbar.')
  })

  test('says when the session has ended', () => {
    render(<Login onLogin={() => {}} ended />)

    expect(screen.getByRole('status')).toHaveTextContent('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.')
  })

  test('says nothing about a session on a first visit', () => {
    render(<Login onLogin={() => {}} />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('offers the language and theme switchers, and switches the language in place', async () => {
    render(<Login onLogin={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: 'English' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument()
    activateLocale('de')
  })

  test.each(['de', 'en'])('has no accessibility violations in %s, also with an error and a notice', async (locale) => {
    activateLocale(locale)
    api.login.mockRejectedValue(new ApiError(401, 'Wrong email or password'))
    const { container } = render(<Login onLogin={() => {}} ended />)
    expect(await axe(container)).toHaveNoViolations()

    await userEvent.type(screen.getByLabelText(locale === 'de' ? 'E-Mail' : 'Email'), 'me@example.com')
    await userEvent.type(screen.getByLabelText(locale === 'de' ? 'Passwort' : 'Password'), 'x')
    await userEvent.click(screen.getByRole('button', { name: locale === 'de' ? 'Anmelden' : 'Log in' }))
    await within(container).findByRole('alert')
    expect(await axe(container)).toHaveNoViolations()
  })
})
