import { render, renderHook } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { MemoryRouter } from 'react-router'
import { i18n } from '@/i18n'

// Testing Library with the I18nProvider every component needs
function wrapper({ children }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

const renderWithI18n = (ui, options) => render(ui, { wrapper, ...options })
const renderHookWithI18n = (callback, options) => renderHook(callback, { wrapper, ...options })

// For components with links or router hooks: the I18nProvider plus a MemoryRouter that starts at `route`
// (a path, or an array of history entries)
const renderWithRouter = (ui, { route = '/', ...options } = {}) => render(ui, {
  wrapper: ({ children }) => (
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={[route].flat()}>{children}</MemoryRouter>
    </I18nProvider>
  ),
  ...options,
})

// The router's location, the page title and the focus move update a tick after the render that shows the new page:
// assert them with `waitFor` or `findBy*` (and `await act(async () => {})` before asserting that nothing moved).
export * from '@testing-library/react'
export { renderWithI18n as render, renderHookWithI18n as renderHook, renderWithRouter }
