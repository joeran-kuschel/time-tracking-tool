import { describe, expect, test } from 'vitest'
import { i18n } from './i18n'
import { formatHours, formatRate, hoursBetween } from './format'

describe('hoursBetween', () => {
  test('returns the hours between start and end', () => {
    expect(hoursBetween('2026-09-21T08:00:00Z', '2026-09-21T09:30:00Z')).toBe(1.5)
  })

  test('returns 0 for running entries', () => {
    expect(hoursBetween('2026-09-21T08:00:00Z', null)).toBe(0)
  })
})

describe('formats follow the language', () => {
  test('German', () => {
    i18n.activate('de')
    expect(formatHours(i18n, 1.5)).toBe('1,50 h')
    expect(formatHours(i18n, '12.25')).toBe('12,25 h')
    expect(formatRate(i18n, '80.00')).toBe('80,00 €/h')
  })

  test('English', () => {
    i18n.activate('en')
    expect(formatHours(i18n, 1.5)).toBe('1.50 h')
    expect(formatRate(i18n, '80.00')).toBe('€80.00/h')
  })
})
