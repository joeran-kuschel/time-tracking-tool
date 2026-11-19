import { describe, expect, test } from 'vitest'
import { i18n } from '@/i18n'
import { formatAmount, formatClock, formatDecimal, parseDecimal, formatDay, formatRate, formatShare, entryMinutes, formatDuration, isoDuration, minutesBetween, minutesOfHours, roundMinutes } from '@/format'

describe('formats follow the language', () => {
  test('German', () => {
    i18n.activate('de')
    expect(formatRate(i18n, '80.00')).toBe('80,00 €/h')
    expect(formatAmount(i18n, 1197.5)).toBe('1.197,50 €')
    expect(formatDay(i18n, new Date(2026, 8, 21, 9, 5))).toBe('Mo., 21. Sept.')
    expect(formatClock(i18n, new Date(2026, 8, 21, 9, 5))).toBe('09:05')
  })

  test('English', () => {
    i18n.activate('en')
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

describe('entryMinutes', () => {
  const entry = (overrides) => ({ start_time: '2026-09-21T08:00:00Z', end_time: '2026-09-21T09:30:00Z', ...overrides })
  const after = (seconds) => entry({ end_time: new Date(Date.UTC(2026, 8, 21, 8, 0, seconds)).toISOString() })

  test('counts the whole minutes between start and end', () => {
    expect(entryMinutes(entry())).toBe(90)
  })

  test('29 seconds are no minute, 30 seconds are one', () => {
    expect(entryMinutes(after(29))).toBe(0)
    expect(entryMinutes(after(30))).toBe(1)
  })

  test('counts a running entry as 0', () => {
    expect(entryMinutes(entry({ end_time: null }))).toBe(0)
  })

  test('keeps the negative minutes of an entry that ends before it starts', () => {
    expect(entryMinutes(entry({ end_time: '2026-09-21T07:00:00Z' }))).toBe(-60)
  })

  test('uses the billed hours of a rounding rule instead of the times', () => {
    expect(entryMinutes(entry({ billed_hours: '1.25' }))).toBe(75)
    expect(entryMinutes(entry({ billed_hours: '0.17' }))).toBe(10)
    expect(entryMinutes(entry({ billed_hours: '0.00' }))).toBe(0)
  })

  test('ignores billed hours that are null', () => {
    expect(entryMinutes(entry({ billed_hours: null }))).toBe(90)
  })
})

describe('formatDecimal and parseDecimal', () => {
  test('show and read an amount in the format of the active language', () => {
    i18n.activate('de')
    expect(formatDecimal(i18n, 80)).toBe('80,00')
    expect(formatDecimal(i18n, '95.5')).toBe('95,50')
    expect(parseDecimal(i18n, '80,5')).toBe(80.5)
    expect(parseDecimal(i18n, ' 80,25 ')).toBe(80.25)

    i18n.activate('en')
    expect(formatDecimal(i18n, 80)).toBe('80.00')
    expect(formatDecimal(i18n, 1234.5)).toBe('1,234.50')
    expect(parseDecimal(i18n, '80.5')).toBe(80.5)
    expect(parseDecimal(i18n, '80')).toBe(80)
  })

  test('an empty text is null, 0 is a number', () => {
    i18n.activate('en')
    expect(parseDecimal(i18n, '')).toBeNull()
    expect(parseDecimal(i18n, '   ')).toBeNull()
    expect(parseDecimal(i18n, '0')).toBe(0)
    expect(parseDecimal(i18n, '0.00')).toBe(0)
  })

  test.each([['abc'], ['-5'], ['+5'], ['8 0'], ['80.123'], ['1,234.50'], ['80,5'], ['.5'], ['5.'], ['1e3'], ['123456789'], ['80.']])(
    'English does not read %j', (text) => {
      i18n.activate('en')
      expect(parseDecimal(i18n, text)).toBeUndefined()
    }
  )

  test.each([['80.5'], ['1.234,50'], ['-5'], ['80,123'], [',5']])('German does not read %j', (text) => {
    i18n.activate('de')
    expect(parseDecimal(i18n, text)).toBeUndefined()
  })

  test('reads the largest rate the database holds', () => {
    i18n.activate('en')
    expect(parseDecimal(i18n, '99999999.99')).toBe(99999999.99)
  })
})
