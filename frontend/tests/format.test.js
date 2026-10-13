import { describe, expect, test } from 'vitest'
import { i18n } from '@/i18n'
import { formatAmount, formatClock, formatDay, formatHours, formatRate, formatShare, hoursBetween } from '@/format'

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
    expect(formatAmount(i18n, 1197.5)).toBe('1.197,50 €')
    expect(formatDay(i18n, new Date(2026, 8, 21, 9, 5))).toBe('Mo., 21. Sept.')
    expect(formatClock(i18n, new Date(2026, 8, 21, 9, 5))).toBe('09:05')
  })

  test('English', () => {
    i18n.activate('en')
    expect(formatHours(i18n, 1.5)).toBe('1.50 h')
    expect(formatRate(i18n, '80.00')).toBe('€80.00/h')
    expect(formatAmount(i18n, 1197.5)).toBe('€1,197.50')
    expect(formatDay(i18n, new Date(2026, 8, 21, 9, 5))).toBe('Mon, Sep 21')
    expect(formatClock(i18n, new Date(2026, 8, 21, 13, 5))).toBe('13:05')
  })
})

describe('formatShare', () => {
  test('formats the share as a whole percentage in the active language', () => {
    i18n.activate('de')
    expect(formatShare(i18n, 3.5, 5)).toBe('70\u00a0%')
    i18n.activate('en')
    expect(formatShare(i18n, 3.5, 5)).toBe('70%')
  })

  test('is 0 when the total is 0', () => {
    i18n.activate('en')
    expect(formatShare(i18n, 0, 0)).toBe('0%')
  })
})
