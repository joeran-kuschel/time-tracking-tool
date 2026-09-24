import { describe, expect, test } from 'vitest'
import {
  byCustomer, dailyHours, dashboardRange, isoWeek, startOfWeek, weekHours, weeklyHours, workingDaysSoFar,
} from './dashboard'

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

describe('weekHours', () => {
  test('adds up the finished entries of the current week', () => {
    expect(weekHours(entries, now)).toBe(1.5 + 4)
  })

  test('includes the days of the week in the month before', () => {
    expect(weekHours(entries, new Date(2026, 8, 2))).toBe(2 + 3.5)
  })
})

test('workingDaysSoFar counts Monday to Friday up to today', () => {
  expect(workingDaysSoFar(now)).toBe(18)
  expect(workingDaysSoFar(new Date(2026, 8, 1))).toBe(1)
  expect(workingDaysSoFar(new Date(2026, 10, 1))).toBe(0) // a Sunday
})

describe('dailyHours', () => {
  test('has one row per day of the month, without entries of other months', () => {
    const days = dailyHours(entries, now)

    expect(days).toHaveLength(30)
    expect(days[0]).toEqual({ date: new Date(2026, 8, 1), hours: 3.5 })
    expect(days[20].hours).toBe(1.5)
    expect(days[23].hours).toBe(0)
    expect(days.reduce((sum, d) => sum + d.hours, 0)).toBe(9)
  })
})

describe('weeklyHours', () => {
  test('has one row per calendar week touching the month, clipped to the month', () => {
    const weeks = weeklyHours(entries, now)

    expect(weeks.map((w) => w.week)).toEqual([36, 37, 38, 39, 40])
    expect(weeks[0]).toEqual({ week: 36, start: new Date(2026, 8, 1), end: new Date(2026, 8, 6), hours: 3.5 })
    expect(weeks[3].hours).toBe(5.5)
    expect(weeks[4]).toMatchObject({ start: new Date(2026, 8, 28), end: new Date(2026, 8, 30), hours: 0 })
  })
})

describe('byCustomer', () => {
  test('adds up hours and amounts per customer, most hours first, with rates and projects', () => {
    const rows = byCustomer(entries.slice(1))

    expect(rows.map((r) => [r.name, r.hours, r.amount])).toEqual([
      ['Muster GmbH', 5, 3.5 * 95 + 1.5 * 80],
      ['Berger', 4, 4 * 85],
    ])
    expect(rows[0].rates).toEqual([80, 95])
    expect(rows[0].projects.map((p) => p.project.name)).toEqual(['Website', 'Shop'])
  })

  test('leaves out customers with only a running entry', () => {
    expect(byCustomer([entries[4]])).toEqual([])
  })
})
