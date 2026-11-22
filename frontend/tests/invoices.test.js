import { describe, expect, test } from 'vitest'
import { i18n } from '@/i18n'
import { activateLocale } from '@/i18n'
import { dayOf, formatInvoiceDay, isDay, MAX_DAYS, overlappingInvoices, periodProblem, previousMonth } from '@/invoices'

describe('isDay', () => {
  test.each([['2026-02-28'], ['2024-02-29'], ['1970-01-01'], ['2026-12-31']])('accepts %s', (day) => {
    expect(isDay(day)).toBe(true)
  })

  test.each([['2026-02-30'], ['2025-02-29'], ['2026-13-01'], ['2026-00-10'], ['2026-2-1'], ['26-02-01'], ['1969-12-31'], [''], [null], [undefined], [20260201], ['2026-02-01T00:00']])('refuses %j', (day) => {
    expect(isDay(day)).toBe(false)
  })
})

describe('dayOf', () => {
  test('is the day of the browser clock with two digits for the month and the day', () => {
    expect(dayOf(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(dayOf(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31')
  })
})

describe('previousMonth', () => {
  test.each([
    [new Date(2026, 2, 5), { from: '2026-02-01', to: '2026-02-28' }],
    [new Date(2026, 0, 31), { from: '2025-12-01', to: '2025-12-31' }],
    [new Date(2024, 2, 1), { from: '2024-02-01', to: '2024-02-29' }],
    [new Date(2026, 4, 31), { from: '2026-04-01', to: '2026-04-30' }],
    [new Date(2026, 11, 15), { from: '2026-11-01', to: '2026-11-30' }],
  ])('before %s is the whole month %j', (today, range) => {
    expect(previousMonth(today)).toEqual(range)
  })

  test('is a valid period the backend takes', () => {
    const { from, to } = previousMonth(new Date(2026, 2, 5))

    expect(periodProblem(from, to)).toBeNull()
  })
})

describe('periodProblem', () => {
  test.each([
    ['2026-02-01', '2026-02-28', null],
    ['2026-02-10', '2026-02-10', null],
    ['2026-02-10', '2026-02-09', 'order'],
    ['', '2026-02-09', 'days'],
    ['2026-02-10', '', 'days'],
    ['2026-02-30', '2026-03-05', 'days'],
    ['2024-01-01', '2024-12-31', null],
    ['2026-01-01', '2027-01-01', null],
    ['2026-01-01', '2027-01-02', 'long'],
    ['2024-01-01', '2025-01-01', 'long'],
  ])('%s to %s: %s', (from, to, problem) => {
    expect(periodProblem(from, to)).toBe(problem)
  })

  test('allows as many days as the backend', () => {
    expect(MAX_DAYS).toBe(366)
  })
})

describe('overlappingInvoices', () => {
  const invoices = [
    { id: 1, customerId: 3, periodFrom: '2026-02-01', periodTo: '2026-02-28' },
    { id: 2, customerId: 3, periodFrom: '2026-03-01', periodTo: '2026-03-31' },
    { id: 3, customerId: 4, periodFrom: '2026-02-01', periodTo: '2026-02-28' },
    { id: 4, customerId: null, periodFrom: '2026-02-01', periodTo: '2026-02-28' },
  ]
  const ids = (from, to, customerId = 3) => overlappingInvoices(invoices, customerId, from, to).map((invoice) => invoice.id)

  test('finds the invoices of the customer with the same period', () => {
    expect(ids('2026-02-01', '2026-02-28')).toEqual([1])
  })

  test('finds a period that only touches the first or the last day, and one inside or around', () => {
    expect(ids('2026-02-28', '2026-03-05')).toEqual([1, 2])
    expect(ids('2026-01-15', '2026-02-01')).toEqual([1])
    expect(ids('2026-02-10', '2026-02-12')).toEqual([1])
    expect(ids('2026-01-01', '2026-12-31')).toEqual([1, 2])
  })

  test('finds nothing for a period before or after, or in a gap, or for another customer', () => {
    expect(ids('2026-01-01', '2026-01-31')).toEqual([])
    expect(ids('2026-04-01', '2026-04-30')).toEqual([])
    expect(ids('2026-02-01', '2026-02-28', 5)).toEqual([])
  })

  test('does not mix up the customers, and never counts an invoice of a deleted customer for a customer', () => {
    expect(ids('2026-02-01', '2026-02-28', 4)).toEqual([3])
    expect(ids('2026-02-01', '2026-02-28', 3)).not.toContain(4)
  })

  test('is empty without invoices', () => {
    expect(overlappingInvoices([], 3, '2026-02-01', '2026-02-28')).toEqual([])
  })
})

describe('formatInvoiceDay', () => {
  test('writes the day in the language, and never moves it with the time zone', () => {
    activateLocale('de')
    expect(formatInvoiceDay(i18n, '2026-03-05')).toBe('05.03.2026')
    expect(formatInvoiceDay(i18n, '2026-01-01')).toBe('01.01.2026')
    activateLocale('en')
    expect(formatInvoiceDay(i18n, '2026-03-05')).toBe('03/05/2026')
    activateLocale('de')
  })
})
