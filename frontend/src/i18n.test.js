import { afterEach, describe, expect, test, vi } from 'vitest'
import { activateLocale, detectLocale, i18n, switchLocale } from './i18n'

function browserLanguage(language) {
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(language)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('detectLocale', () => {
  test('uses German for German browsers', () => {
    browserLanguage('de-AT')
    expect(detectLocale()).toBe('de')
  })

  test('uses English for English browsers', () => {
    browserLanguage('en-US')
    expect(detectLocale()).toBe('en')
  })

  test('falls back to English for other languages', () => {
    browserLanguage('fr-FR')
    expect(detectLocale()).toBe('en')
  })

  test('prefers the stored choice over the browser language', () => {
    browserLanguage('de-DE')
    window.localStorage.setItem('language', 'en')
    expect(detectLocale()).toBe('en')
  })

  test('ignores unknown stored values', () => {
    browserLanguage('de-DE')
    window.localStorage.setItem('language', 'toString')
    expect(detectLocale()).toBe('de')
  })
})

describe('switching the language', () => {
  test('activates the language, sets <html lang> and remembers the choice', () => {
    switchLocale('en')
    expect(i18n.locale).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(window.localStorage.getItem('language')).toBe('en')
  })

  test('activating on startup does not store the detected language', () => {
    activateLocale('en')
    expect(document.documentElement.lang).toBe('en')
    expect(window.localStorage.getItem('language')).toBeNull()
  })
})
