import { msg } from '@lingui/core/macro'

// The report language of a customer: the language of its PDF and CSV files. In the customer's form it is one choice:
// 'app' (the language of the app at download time: the customer has no language of its own), 'de' or 'en'. The API
// field is reportLanguage: null for the language of the app, else 'de' or 'en' (backend/src/i18n.js LOCALES).
export const APP_LANGUAGE = 'app'

const languageNames = { de: msg`German`, en: msg`English` }

// The choices for a select: [{ value, label }], the language of the app first. i18n translates the labels.
export function reportLanguageOptions(i18n) {
  return [
    { value: APP_LANGUAGE, label: i18n._(msg`Same as the app`) },
    ...Object.entries(languageNames).map(([value, label]) => ({ value, label: i18n._(label) })),
  ]
}

// The choice that a customer record (report_language from the API) has
export const reportLanguageValueOf = (customer) => customer?.report_language ?? APP_LANGUAGE

// The API field of a choice: null for the language of the app
export const reportLanguageFieldOf = (value) => (value === APP_LANGUAGE ? null : value)

// The name of a language code ('de' or 'en') in the active language
export const languageName = (i18n, code) => i18n._(languageNames[code])
