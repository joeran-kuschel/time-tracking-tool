import { describe, expect, test } from 'vitest'
import {
  byCustomer, dailyMinutes, dashboardRange, isoWeek, startOfWeek, trackedMinutes, weekMinutes, weeklyMinutes, workingDaysSoFar,
} from '@/dashboard'

// Thursday, 24 September 2026
const now = new Date(2026, 8, 24, 15, 0)

const entry = (id, customer, project, rate, start, end) => ({
  id, customer_id: customer.id, customer_name: customer.name, project_id: project.id, project_name: project.name,
  hourly_rate: rate, start_time: start, end_time: end,
})
const muster = { id: 1, name: 'Muster GmbH' }
const berger = { id: 2, name: 'Berger' }
const website = { id: 7, name: 'Website' }
const shop = { id: 8, name: 'Shop' }
const pflege = { id: 9, name: 'Pflege' }

const entries = [
  entry(1, muster, website, '95.00', '2026-08-31T09:00:00', '2026-08-31T11:00:00'), // Monday before the month
  entry(2, muster, website, '95.00', '2026-09-01T09:00:00', '2026-09-01T12:30:00'),
  entry(3, muster, shop, '80.00', '2026-09-21T09:00:00', '2026-09-21T10:30:00'),
  entry(4, berger, pflege, '85.00', '2026-09-22T13:00:00', '2026-09-22T17:00:00'),
  entry(5, berger, pflege, '85.00', '2026-09-24T09:00:00', null), // running
]

describe('weeks', () => {
  test('start on Monday', () => {
    expect(startOfWeek(now)).toEqual(new Date(2026, 8, 21))
    expect(startOfWeek(new Date(2026, 8, 27, 23))).toEqual(new Date(2026, 8, 21))
    expect(startOfWeek(new Date(2026, 8, 21))).toEqual(new Date(2026, 8, 21))
  })

  test('are numbered by ISO 8601', () => {
    expect(isoWeek(now)).toBe(39)
    expect(isoWeek(new Date(2026, 8, 1))).toBe(36)
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53)
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1)
  })
})

describe('dashboardRange', () => {
  test('covers the month', () => {
    expect(dashboardRange(now)).toEqual({ from: new Date(2026, 8, 1), to: new Date(2026, 9, 1) })
  })

  test('reaches back when the week started in the month before', () => {
    expect(dashboardRange(new Date(2026, 8, 2))).toEqual({ from: new Date(2026, 7, 31), to: new Date(2026, 9, 1) })
  })

  test('reaches ahead when the week ends in the next month', () => {
    expect(dashboardRange(new Date(2026, 8, 29))).toEqual({ from: new Date(2026, 8, 1), to: new Date(2026, 9, 5) })
  })
})

describe('weekMinutes', () => {
  test('adds up the finished entries of the current week', () => {
    expect(weekMinutes(entries, now)).toBe(90 + 240)
  })

  test('includes the days of the week in the month before', () => {
    expect(weekMinutes(entries, new Date(2026, 8, 2))).toBe(120 + 210)
  })
})

test('workingDaysSoFar counts Monday to Friday up to today', () => {
  expect(workingDaysSoFar(now)).toBe(18)
  expect(workingDaysSoFar(new Date(2026, 8, 1))).toBe(1)
  expect(workingDaysSoFar(new Date(2026, 10, 1))).toBe(0) // a Sunday
})

describe('dailyMinutes', () => {
  test('has one row per day of the month, without entries of other months', () => {
    const days = dailyMinutes(entries, now)

    expect(days).toHaveLength(30)
    expect(days[0]).toEqual({ date: new Date(2026, 8, 1), minutes: 210 })
    expect(days[20].minutes).toBe(90)
    expect(days[23].minutes).toBe(0)
    expect(days.reduce((sum, d) => sum + d.minutes, 0)).toBe(540)
  })
})

describe('weeklyMinutes', () => {
  test('has one row per calendar week touching the month, clipped to the month', () => {
    const weeks = weeklyMinutes(entries, now)

    expect(weeks.map((w) => w.week)).toEqual([36, 37, 38, 39, 40])
    expect(weeks[0]).toEqual({ week: 36, start: new Date(2026, 8, 1), end: new Date(2026, 8, 6), minutes: 210 })
    expect(weeks[3].minutes).toBe(330)
    expect(weeks[4]).toMatchObject({ start: new Date(2026, 8, 28), end: new Date(2026, 8, 30), minutes: 0 })
  })
})

describe('byCustomer', () => {
  test('adds up hours and amounts per customer, most hours first, with rates and projects', () => {
    const rows = byCustomer(entries.slice(1))

    expect(rows.map((r) => [r.name, r.minutes, r.amount])).toEqual([
      ['Muster GmbH', 300, 3.5 * 95 + 1.5 * 80],
      ['Berger', 240, 4 * 85],
    ])
    expect(rows[0].rates).toEqual([80, 95])
    expect(rows[0].projects.map((p) => p.project.name)).toEqual(['Website', 'Shop'])
  })

  test('leaves out customers with only a running entry', () => {
    expect(byCustomer([entries[4]])).toEqual([])
  })
})

describe('billing figures with rounded hours', () => {
  const at = (id, customer, projectId, rate, start, end, billed) => ({
    id, customer_id: customer, customer_name: `K${customer}`, project_id: projectId, project_name: `P${projectId}`, hourly_rate: rate,
    start_time: start, end_time: end, ...(billed ? { billed_hours: billed[0], billed_amount: billed[1] } : {}),
  })
  const rounded = [
    at(1, 1, 7, '95.00', '2026-09-01T09:00:00', '2026-09-01T10:05:00', ['1.25', '118.75']),
    at(2, 1, 8, '80.00', '2026-09-21T09:00:00', '2026-09-21T09:20:00', ['0.50', '40.00']),
    at(3, 2, 9, '85.00', '2026-09-22T13:00:00', '2026-09-22T13:07:00', ['0.25', '21.25']),
  ]

  test('byCustomer adds up the billed hours and amounts per customer', () => {
    const rows = byCustomer(rounded)

    expect(rows.map((r) => [r.name, r.minutes, r.amount])).toEqual([['K1', 105, 158.75], ['K2', 15, 21.25]])
  })

  test('the tracked minutes stay exact: trackedMinutes ignores billed_hours', () => {
    expect(trackedMinutes(rounded)).toBe(65 + 20 + 7)
    expect(trackedMinutes(rounded)).not.toBe(120)
  })

  test('the week minutes and the daily minutes stay exact', () => {
    const now = new Date(2026, 8, 24, 15, 0)

    expect(weekMinutes(rounded, now)).toBe(20 + 7)
    expect(dailyMinutes(rounded, now)[0].minutes).toBe(65)
  })

  test('trackedMinutes counts a running entry as 0', () => {
    expect(trackedMinutes([{ start_time: '2026-09-22T10:00:00', end_time: null }])).toBe(0)
  })
})

describe('byCustomer in whole minutes', () => {
  test('twelve entries of 5 minutes (billed 0.08 h) are 60 minutes, six of 10 minutes (0.17 h) too', () => {
    const many = (customer, count, billed) => Array.from({ length: count }, (_, i) => ({
      id: customer * 100 + i, customer_id: customer, customer_name: `K${customer}`, project_id: customer, project_name: 'P', hourly_rate: '60.00',
      start_time: '2026-09-21T09:00:00', end_time: '2026-09-21T09:03:00', billed_hours: billed, billed_amount: '1.00',
    }))

    const rows = byCustomer([...many(1, 12, '0.08'), ...many(2, 6, '0.17')])

    expect(rows.map((r) => [r.name, r.minutes])).toEqual([['K1', 60], ['K2', 60]])
  })

  test('sums whole minutes per entry: three entries of 30 seconds are 3 minutes', () => {
    const half = (id) => ({ id, start_time: '2026-09-21T09:00:00', end_time: '2026-09-21T09:00:30' })

    expect(trackedMinutes([1, 2, 3].map(half))).toBe(3)
  })
})
