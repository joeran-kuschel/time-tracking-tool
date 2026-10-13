import React from 'react'
import ReactDOM from 'react-dom/client'
import { I18nProvider } from '@lingui/react'
import AuthGate from './components/AuthGate.jsx'
import { activateLocale, detectLocale, i18n } from './i18n'
import { applyTheme, storedTheme } from './theme'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/newsreader/500.css'
import '@fontsource/newsreader/600.css'
import './index.css'

activateLocale(detectLocale())
// Before the first render, so the page doesn't flash in the wrong theme
applyTheme(storedTheme())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider i18n={i18n}>
      <AuthGate />
    </I18nProvider>
  </React.StrictMode>,
)
