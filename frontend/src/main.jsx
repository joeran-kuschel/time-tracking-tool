import React from 'react'
import ReactDOM from 'react-dom/client'
import { I18nProvider } from '@lingui/react'
import App from './App.jsx'
import { activateLocale, detectLocale, i18n } from './i18n'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/newsreader/500.css'
import '@fontsource/newsreader/600.css'
import './index.css'

activateLocale(detectLocale())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider i18n={i18n}>
      <App />
    </I18nProvider>
  </React.StrictMode>,
)
