import { afterEach, describe, expect, test } from 'vitest'
import { i18n } from '@/i18n'
import { APP_LANGUAGE, languageName, reportLanguageFieldOf, reportLanguageOptions, reportLanguageValueOf } from '@/reportLanguage'

afterEach(() => i18n.activate('de'))

describe('reportLanguage', () => {
  test('offers the language of the app first, then German and English, in the active language', () => {
    i18n.activate('de')
    expect(reportLanguageOptions(i18n)).toEqual([
      { value: 'app', label: 'Wie die App' },
      { value: 'de', label: 'Deutsch' },
      { value: 'en', label: 'Englisch' },
    ])

    i18n.activate('en')
    expect(reportLanguageOptions(i18n)).toEqual([
      { value: 'app', label: 'Same as the app' },
      { value: 'de', label: 'German' },
      { value: 'en', label: 'English' },
    ])
  })

  test('a customer without a language (or without the field, as before the migration) has the choice of the app', () => {
    expect(reportLanguageValueOf({ report_language: null })).toBe(APP_LANGUAGE)
    expect(reportLanguageValueOf({})).toBe(APP_LANGUAGE)
    expect(reportLanguageValueOf(undefined)).toBe(APP_LANGUAGE)
  })

  test('a customer with a language has that choice', () => {
    expect(reportLanguageValueOf({ report_language: 'de' })).toBe('de')
    expect(reportLanguageValueOf({ report_language: 'en' })).toBe('en')
  })

  test('the API field is null for the language of the app, else the language', () => {
    expect(reportLanguageFieldOf(APP_LANGUAGE)).toBeNull()
    expect(reportLanguageFieldOf('de')).toBe('de')
    expect(reportLanguageFieldOf('en')).toBe('en')
  })

  test('names a language in the active language', () => {
    i18n.activate('de')
    expect(languageName(i18n, 'en')).toBe('Englisch')
    i18n.activate('en')
    expect(languageName(i18n, 'de')).toBe('German')
  })
})
