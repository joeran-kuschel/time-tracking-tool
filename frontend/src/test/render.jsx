import { render, renderHook } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '../i18n'

// Testing Library with the I18nProvider every component needs
function wrapper({ children }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

const renderWithI18n = (ui, options) => render(ui, { wrapper, ...options })
const renderHookWithI18n = (callback, options) => renderHook(callback, { wrapper, ...options })

export * from '@testing-library/react'
export { renderWithI18n as render, renderHookWithI18n as renderHook }
