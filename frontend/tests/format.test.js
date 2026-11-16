import { describe, expect, test } from 'vitest'
import { i18n } from '@/i18n'
import { formatAmount, formatClock, formatDay, formatHours, formatRate, formatShare, hoursBetween, formatDuration, isoDuration, minutesBetween, minutesOfHours, roundMinutes } from '@/format'

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

describe('minutesBetween', () => {
  const at = (seconds) => minutesBetween('2026-09-21T08:00:00Z', new Date(Date.UTC(2026, 8, 21, 8, 0, seconds)).toISOString())

  test('counts whole minutes, 30 seconds up', () => {
    expect(at(0)).toBe(0)
    expect(at(29)).toBe(0)
    expect(at(30)).toBe(1)
    expect(at(59)).toBe(1)
    expect(at(90)).toBe(2)
  })

  test('is 0 for a running entry', () => {
    expect(minutesBetween('2026-09-21T08:00:00Z', null)).toBe(0)
  })

  test('rounds a negative span away from zero, like the database', () => {
    expect(minutesBetween('2026-09-21T08:01:30Z', '2026-09-21T08:00:00Z')).toBe(-2)
  })
})

describe('minutesOfHours', () => {
  test('turns decimal hours of the server into whole minutes', () => {
    expect(minutesOfHours('0.08')).toBe(5)
    expect(minutesOfHours('0.17')).toBe(10)
    expect(minutesOfHours('1.25')).toBe(75)
    expect(minutesOfHours(0)).toBe(0)
    expect(minutesOfHours('-0.5')).toBe(-30)
  })

  test('roundMinutes rounds halves away from zero', () => {
    expect(roundMinutes(0.5)).toBe(1)
    expect(roundMinutes(-0.5)).toBe(-1)
    expect(roundMinutes(2.4)).toBe(2)
  })
})

describe('formatDuration', () => {
  test.each(['de', 'en'])('shows h:mm h the same in %s', (language) => {
    i18n.activate(language)
    expect(formatDuration(i18n, 0)).toBe('0:00 h')
    expect(formatDuration(i18n, 5)).toBe('0:05 h')
    expect(formatDuration(i18n, 239)).toBe('3:59 h')
    expect(formatDuration(i18n, 60)).toBe('1:00 h')
    expect(formatDuration(i18n, 6045)).toBe('100:45 h')
    expect(formatDuration(i18n, -90)).toBe('-1:30 h')
  })

  test('rounds fractions of a minute and never shows -0:00', () => {
    expect(formatDuration(i18n, 0.5)).toBe('0:01 h')
    expect(formatDuration(i18n, 0.4)).toBe('0:00 h')
    expect(formatDuration(i18n, -0.4)).toBe('0:00 h')
  })

  test('takes the minutes of numeric strings', () => {
    expect(formatDuration(i18n, '75')).toBe('1:15 h')
  })
})

describe('isoDuration', () => {
  test('writes the duration for the datetime attribute', () => {
    expect(isoDuration(239)).toBe('PT3H59M')
    expect(isoDuration(0)).toBe('PT0H0M')
    expect(isoDuration(6045)).toBe('PT100H45M')
  })

  test('has none for a negative duration', () => {
    expect(isoDuration(-90)).toBeNull()
  })
})
