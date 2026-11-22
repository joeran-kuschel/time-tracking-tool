import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { act, render, screen, waitFor } from '../support/render'
import { axe } from '../support/axe'
import LogoField from '@/components/LogoField'
import { settingsGroups } from '@/settingsGroups'
import { api, ApiError } from '@/api'
import { activateLocale } from '@/i18n'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { getLogo: vi.fn(), putLogo: vi.fn(), deleteLogo: vi.fn() },
}))

const option = settingsGroups.flatMap((group) => group.options).find((o) => o.type === 'logo')
const png = (bytes = [1, 2, 3], name = 'logo.png') => new File([new Uint8Array(bytes)], name, { type: 'image/png' })
// The file field takes any file in these tests, as the browser's accept list is not what they are about
const user = () => userEvent.setup({ applyAccept: false })
const field = () => screen.getByLabelText('Logo')
const NO_LOGO = new ApiError(404, 'No logo stored')

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  api.getLogo.mockRejectedValue(NO_LOGO)
  api.putLogo.mockResolvedValue({ contentType: 'image/png', bytes: 3 })
  api.deleteLogo.mockResolvedValue(null)
})

afterEach(() => activateLocale('de'))

async function renderField(logo = null) {
  if (logo) api.getLogo.mockResolvedValue(new Blob([logo], { type: 'image/png' }))
  const result = render(<LogoField option={option} />)
  if (logo) await screen.findByRole('img', { name: 'Dein Logo' })
  else await waitFor(() => expect(api.getLogo).toHaveBeenCalled())
  await waitFor(() => expect(field()).toBeEnabled()) // the field is disabled while the logo loads
  return result
}

describe('LogoField', () => {
  test('has a labelled file field for PNG and JPEG, described by its hint, and no preview without a logo', async () => {
    await renderField()

    expect(field()).toHaveAttribute('type', 'file')
    expect(field()).toHaveAttribute('accept', 'image/png,image/jpeg')
    expect(field()).toHaveAccessibleDescription(/PNG oder JPEG, bis zu 1 MB und 2000 × 2000 Pixel\./)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Logo entfernen' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('the file field is disabled while the logo loads and usable after, also when there is none or loading failed', async () => {
    let finish
    api.getLogo.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    render(<LogoField option={option} />)

    expect(field()).toBeDisabled()
    await act(async () => finish(new Blob(['png'])))
    expect(field()).toBeEnabled()
  })

  test('the file field is usable when there is no logo, and when loading failed', async () => {
    await renderField()
    await waitFor(() => expect(field()).toBeEnabled())
  })

  test('the file field is usable when loading failed', async () => {
    api.getLogo.mockRejectedValue(new ApiError(500, 'boom'))
    render(<LogoField option={option} />)

    await screen.findByRole('alert')
    expect(field()).toBeEnabled()
  })

  test('lets go of the image that a new logo showed, too, when the page is left', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const { unmount } = await renderField()
    await user().upload(field(), png())
    const shown = (await screen.findByRole('img', { name: 'Dein Logo' })).getAttribute('src')

    unmount()

    expect(revoke).toHaveBeenCalledWith(shown)
  })

  test('shows the stored logo as a preview with a text alternative, and a Remove button', async () => {
    await renderField('png bytes')

    expect(screen.getByRole('img', { name: 'Dein Logo' })).toHaveAttribute('src', expect.stringMatching(/^blob:/))
    expect(screen.getByRole('button', { name: 'Logo entfernen' })).toBeInTheDocument()
  })

  test('a failed load shows an error with a hint to try again; no logo (404) is no error', async () => {
    api.getLogo.mockRejectedValue(new ApiError(500, 'boom'))
    render(<LogoField option={option} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Das Logo konnte nicht geladen werden. Bitte versuche es erneut.')
  })

  test('stores a chosen PNG as base64 at once, shows it and says so politely, with the focus on the field', async () => {
    await renderField()

    await user().upload(field(), png([1, 2, 3]))

    await waitFor(() => expect(api.putLogo).toHaveBeenCalledWith({ contentType: 'image/png', data: 'AQID' }))
    expect(await screen.findByRole('img', { name: 'Dein Logo' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Logo gespeichert.')
    expect(field()).toHaveFocus()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('stores a JPEG too', async () => {
    await renderField()

    await user().upload(field(), new File([new Uint8Array([255, 216, 255])], 'logo.jpg', { type: 'image/jpeg' }))

    await waitFor(() => expect(api.putLogo).toHaveBeenCalledWith({ contentType: 'image/jpeg', data: '/9j/' }))
  })

  test('choosing the same file again stores it again', async () => {
    await renderField()
    const file = png()

    await user().upload(field(), file)
    await screen.findByRole('img', { name: 'Dein Logo' })
    await user().upload(field(), file)

    await waitFor(() => expect(api.putLogo).toHaveBeenCalledTimes(2))
  })

  test('a new logo replaces the preview and lets go of the old image', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    await renderField('first')
    const first = screen.getByRole('img', { name: 'Dein Logo' }).getAttribute('src')

    await user().upload(field(), png())

    await waitFor(() => expect(screen.getByRole('img', { name: 'Dein Logo' }).getAttribute('src')).not.toBe(first))
    expect(revoke).toHaveBeenCalledWith(first)
  })

  test('lets go of the image when the page is left', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const { unmount } = await renderField('first')
    const src = screen.getByRole('img', { name: 'Dein Logo' }).getAttribute('src')

    unmount()

    expect(revoke).toHaveBeenCalledWith(src)
  })

  test('refuses an SVG in the browser, names the types, and sends nothing', async () => {
    await renderField()

    await user().upload(field(), new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Wähle ein PNG- oder JPEG-Bild. Andere Typen, etwa SVG, werden nicht angenommen.')
    expect(field()).toHaveAttribute('aria-invalid', 'true')
    expect(field()).toHaveAccessibleDescription(/Andere Typen, etwa SVG/)
    expect(api.putLogo).not.toHaveBeenCalled()
  })

  test('refuses a file of more than 1 MB, names the limit, and sends nothing; exactly 1 MB is sent', async () => {
    await renderField()

    await user().upload(field(), png(new Array(1024 * 1024 + 1).fill(0)))
    expect(await screen.findByRole('alert')).toHaveTextContent('Das Logo ist größer als 1 MB. Wähle eine kleinere Datei.')
    expect(api.putLogo).not.toHaveBeenCalled()

    await user().upload(field(), png(new Array(1024 * 1024).fill(0)))
    await waitFor(() => expect(api.putLogo).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('the error of the browser goes away with the next choice', async () => {
    await renderField()
    await user().upload(field(), new File(['x'], 'a.gif', { type: 'image/gif' }))
    await screen.findByRole('alert')

    await user().upload(field(), png())

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  test.each([
    [400, /Das Logo konnte nicht gespeichert werden\. Wähle ein PNG- oder JPEG-Bild mit höchstens 1 MB und 2000 × 2000 Pixeln\./],
    [413, /Das Logo konnte nicht gespeichert werden\. Die Datei ist zu groß\. Wähle ein Bild mit höchstens 1 MB\./],
    [500, /Das Logo konnte nicht gespeichert werden\. Bitte versuche es erneut\./],
    [0, /Das Logo konnte nicht gespeichert werden\. Der Server ist nicht erreichbar\./],
  ])('an answer of %i keeps the old logo and shows what to do', async (status, message) => {
    await renderField('old')
    api.putLogo.mockRejectedValue(new ApiError(status, 'nope'))
    const old = screen.getByRole('img', { name: 'Dein Logo' }).getAttribute('src')

    await user().upload(field(), png())

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByRole('img', { name: 'Dein Logo' })).toHaveAttribute('src', old)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  test('Remove removes the logo at once, says so politely and moves the focus to the file field', async () => {
    await renderField('old')

    await userEvent.click(screen.getByRole('button', { name: 'Logo entfernen' }))

    expect(api.deleteLogo).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('img')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Logo entfernen' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Logo entfernt.')
    expect(field()).toHaveFocus()
  })

  test('a failed removal keeps the logo and shows an error', async () => {
    await renderField('old')
    api.deleteLogo.mockRejectedValue(new ApiError(500, 'boom'))

    await userEvent.click(screen.getByRole('button', { name: 'Logo entfernen' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Das Logo konnte nicht entfernt werden. Bitte versuche es erneut.')
    expect(screen.getByRole('img', { name: 'Dein Logo' })).toBeInTheDocument()
  })

  test('a second click while the removal runs sends one request', async () => {
    await renderField('old')
    let finish
    api.deleteLogo.mockReturnValue(new Promise((resolve) => { finish = resolve }))

    await userEvent.click(screen.getByRole('button', { name: 'Logo entfernen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Logo entfernen' }))
    await act(async () => finish(null))

    expect(api.deleteLogo).toHaveBeenCalledTimes(1)
  })

  test('is in English after a language switch', async () => {
    await renderField('old')

    act(() => activateLocale('en'))

    expect(screen.getByLabelText('Logo')).toHaveAccessibleDescription(/PNG or JPEG, up to 1 MB and 2000 × 2000 pixels\./)
    expect(screen.getByRole('img', { name: 'Your logo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove logo' })).toBeInTheDocument()
  })

  test('has no accessibility violations: without a logo, with one, and with an error, in German and English', async () => {
    const { container } = await renderField()
    expect(await axe(container)).toHaveNoViolations()

    await user().upload(field(), png())
    await screen.findByRole('img', { name: 'Dein Logo' })
    expect(await axe(container)).toHaveNoViolations()

    await user().upload(field(), new File(['x'], 'a.gif', { type: 'image/gif' }))
    await screen.findByRole('alert')
    expect(await axe(container)).toHaveNoViolations()

    act(() => activateLocale('en'))
    expect(await axe(container)).toHaveNoViolations()
  })
})
