import { i18n } from '@lingui/core'
import { messages as en } from './locales/en/messages.po'
import { messages as de } from './locales/de/messages.po'

export const LANGUAGES = { de: 'Deutsch', en: 'English' }
const STORAGE_KEY = 'language'

i18n.load({ en, de })

// The stored choice first, then the browser language; English for all other languages
export function detectLocale() {
  let stored = null
  try {
    stored = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // storage can be blocked, e.g. in private windows
  }
  if (stored && Object.hasOwn(LANGUAGES, stored)) return stored
  return navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en'
}

export function activateLocale(locale) {
  i18n.activate(locale)
  document.documentElement.lang = locale
}

// Switches the language without reloading and remembers the choice
export function switchLocale(locale) {
  activateLocale(locale)
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // the switch still works for this visit
  }
}

export { i18n }
