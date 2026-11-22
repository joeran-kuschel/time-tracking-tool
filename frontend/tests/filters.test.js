import { describe, expect, test } from 'vitest'
import { emptyFilters, isReversed, openingFilters, periodPreset, toQuery } from '@/filters'

// Wednesday, local time
const now = new Date(2026, 8, 23, 14, 30)

describe('periodPreset', () => {
  test.each([
    ['any', { from: '', to: '' }],
    ['today', { from: '2026-09-23', to: '2026-09-23' }],
    ['thisWeek', { from: '2026-09-21', to: '2026-09-27' }],
    ['lastWeek', { from: '2026-09-14', to: '2026-09-20' }],
    ['thisMonth', { from: '2026-09-01', to: '2026-09-30' }],
    ['lastMonth', { from: '2026-08-01', to: '2026-08-31' }],
    ['thisYear', { from: '2026-01-01', to: '2026-12-31' }],
  ])('%s', (preset, expected) => {
    expect(periodPreset(preset, now)).toEqual(expected)
  })

  test('starts the week on Monday, also when today is Sunday or Monday', () => {
    expect(periodPreset('thisWeek', new Date(2026, 8, 27))).toEqual({ from: '2026-09-21', to: '2026-09-27' })
    expect(periodPreset('thisWeek', new Date(2026, 8, 21))).toEqual({ from: '2026-09-21', to: '2026-09-27' })
  })

  test('starts the weeks on Sunday when asked to, also when today is Saturday or Sunday', () => {
    expect(periodPreset('thisWeek', now, 0)).toEqual({ from: '2026-09-20', to: '2026-09-26' })
    expect(periodPreset('lastWeek', now, 0)).toEqual({ from: '2026-09-13', to: '2026-09-19' })
    expect(periodPreset('thisWeek', new Date(2026, 8, 26), 0)).toEqual({ from: '2026-09-20', to: '2026-09-26' })
    expect(periodPreset('thisWeek', new Date(2026, 8, 27), 0)).toEqual({ from: '2026-09-27', to: '2026-10-03' })
    expect(periodPreset('thisWeek', now, 1)).toEqual(periodPreset('thisWeek', now))
  })

  test('the first day does not change the other periods', () => {
    for (const preset of ['any', 'today', 'thisMonth', 'lastMonth', 'thisYear', 'custom']) {
      expect(periodPreset(preset, now, 0)).toEqual(periodPreset(preset, now))
    }
  })

  test('crosses month and year ends', () => {
    expect(periodPreset('lastMonth', new Date(2026, 0, 5))).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(periodPreset('lastWeek', new Date(2026, 0, 5))).toEqual({ from: '2025-12-29', to: '2026-01-04' })
    expect(periodPreset('thisMonth', new Date(2028, 1, 10))).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  test('custom has no dates of its own', () => {
    expect(periodPreset('custom', now)).toBeNull()
  })
})

describe('openingFilters', () => {
  test('opens with the current month and nothing else', () => {
    expect(openingFilters(now)).toEqual({ ...emptyFilters, preset: 'thisMonth', from: '2026-09-01', to: '2026-09-30' })
  })
})

describe('toQuery', () => {
  test('leaves out empty values and keeps the order', () => {
    expect(toQuery(emptyFilters)).toEqual({ sort: 'newest' })
  })

  test('trims the search text and leaves it out when only spaces', () => {
    expect(toQuery({ ...emptyFilters, q: '  Konzept ' }).q).toBe('Konzept')
    expect(toQuery({ ...emptyFilters, q: '   ' })).not.toHaveProperty('q')
  })

  test('passes ids, dates and the sort order', () => {
    expect(toQuery({ ...emptyFilters, customerId: '2', projectId: '5', from: '2026-09-01', to: '2026-09-30', sort: 'oldest' }))
      .toEqual({ customerId: '2', projectId: '5', from: '2026-09-01', to: '2026-09-30', sort: 'oldest' })
  })

  test('does not send the preset', () => {
    expect(toQuery(openingFilters(now))).not.toHaveProperty('preset')
  })
})

describe('isReversed', () => {
  test('is true only when both dates are set and the end is before the start', () => {
    expect(isReversed({ from: '2026-09-02', to: '2026-09-01' })).toBe(true)
    expect(isReversed({ from: '2026-09-01', to: '2026-09-01' })).toBe(false)
    expect(isReversed({ from: '2026-09-02', to: '' })).toBe(false)
    expect(isReversed({ from: '', to: '2026-09-01' })).toBe(false)
  })
})
