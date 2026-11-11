import { describe, expect, test } from 'vitest'
import { inMonth, projectsOf, summarize } from '@/summary'

const projects = [{ id: 7, name: 'Website', hourly_rate: '95.00' }, { id: 8, name: 'Wartung', hourly_rate: '80.00' }, { id: 9, name: 'Leer', hourly_rate: '50.00' }]
const entries = [
  { id: 1, project_id: 7, start_time: '2026-09-21T09:00:00', end_time: '2026-09-21T12:30:00' },
  { id: 2, project_id: 8, start_time: '2026-09-17T14:00:00', end_time: '2026-09-17T15:30:00' },
  { id: 3, project_id: 7, start_time: '2026-09-22T10:00:00', end_time: null },
]

describe('summarize', () => {
  test('adds up hours and amounts of finished entries, per project in project order', () => {
    const summary = summarize(entries, projects)

    expect(summary.hours).toBe(5)
    expect(summary.amount).toBe(3.5 * 95 + 1.5 * 80)
    expect(summary.count).toBe(2)
    expect(summary.projects.map((p) => [p.project.name, p.hours])).toEqual([['Website', 3.5], ['Wartung', 1.5]])
  })

  test('is empty without entries', () => {
    expect(summarize([], projects)).toEqual({ hours: 0, amount: 0, count: 0, projects: [] })
  })
})

describe('summarize with rounded hours (billed_hours and billed_amount from the server)', () => {
  // 65 min is 1.25 h at 95.00 = 118.75; 20 min is 0.50 h at 80.00 = 40.00; exact: 1.0833 h and 0.3333 h
  const rounded = [
    { id: 1, project_id: 7, start_time: '2026-09-21T09:00:00', end_time: '2026-09-21T10:05:00', billed_hours: '1.25', billed_amount: '118.75' },
    { id: 2, project_id: 8, start_time: '2026-09-17T14:00:00', end_time: '2026-09-17T14:20:00', billed_hours: '0.50', billed_amount: '40.00' },
  ]

  test('counts the billed hours and the billed amounts, not the exact ones', () => {
    const summary = summarize(rounded, projects)

    expect(summary.hours).toBe(1.75)
    expect(summary.amount).toBeCloseTo(158.75, 10)
    expect(summary.count).toBe(2)
    expect(summary.projects.map((p) => [p.project.name, p.hours, p.amount])).toEqual([['Website', 1.25, 118.75], ['Wartung', 0.5, 40]])
  })

  test('uses the amounts of the server, rounded to cents per entry like the report, not hours x rate of the sum', () => {
    // 0.25 h at 33.33 is 8.3325: the report counts 8.33 for each of the three entries, 24.99 in all, not 25.00
    const project = [{ id: 7, name: 'Web', hourly_rate: '33.33' }]
    const three = [1, 2, 3].map((id) => ({
      id, project_id: 7, start_time: `2026-09-0${id}T09:00:00`, end_time: `2026-09-0${id}T09:07:00`, billed_hours: '0.25', billed_amount: '8.33',
    }))

    const summary = summarize(three, project)

    expect(summary.hours).toBe(0.75)
    expect(summary.amount).toBeCloseTo(24.99, 10)
  })

  test('counts an entry without billed hours as before, next to rounded ones', () => {
    const backwards = { id: 3, project_id: 7, start_time: '2026-09-22T12:00:00', end_time: '2026-09-22T11:00:00', billed_hours: null, billed_amount: null }

    const summary = summarize([...rounded, backwards], projects)

    expect(summary.projects.map((p) => [p.project.name, p.hours])).toEqual([['Website', 0.25], ['Wartung', 0.5]])
    expect(summary.amount).toBeCloseTo(118.75 - 95 + 40, 10)
  })

  test('leaves a running entry out, whatever it carries', () => {
    const running = { id: 4, project_id: 7, start_time: '2026-09-22T10:00:00', end_time: null, billed_hours: null, billed_amount: null }

    const summary = summarize([...rounded, running], projects)

    expect(summary.count).toBe(2)
    expect(summary.hours).toBe(1.75)
  })

  test('without billed fields the figures are exactly as before', () => {
    const before = summarize(entries, projects)

    expect(before.hours).toBe(5)
    expect(before.amount).toBe(3.5 * 95 + 1.5 * 80)
  })

  test('an entry with only one of the two billed values counts as exact, so hours and amount never disagree', () => {
    const onlyHours = { ...rounded[0], billed_amount: undefined }
    const onlyAmount = { ...rounded[1], billed_hours: null }

    const summary = summarize([onlyHours, onlyAmount], projects)

    // 65 min and 20 min at their project's rate, exact
    expect(summary.hours).toBeCloseTo((65 + 20) / 60, 10)
    expect(summary.amount).toBeCloseTo((65 / 60) * 95 + (20 / 60) * 80, 10)
  })
})

describe('inMonth', () => {
  test('checks the month of the start time', () => {
    expect(inMonth(entries[0], new Date(2026, 8, 1))).toBe(true)
    expect(inMonth(entries[0], new Date(2026, 9, 1))).toBe(false)
    expect(inMonth(entries[0], new Date(2025, 8, 1))).toBe(false)
  })
})

describe('projectsOf', () => {
  test('collects the projects of report entries once each', () => {
    const reportEntries = [
      { project_id: 8, project_name: 'Wartung', hourly_rate: '80.00' },
      { project_id: 7, project_name: 'Website', hourly_rate: '95.00' },
      { project_id: 8, project_name: 'Wartung', hourly_rate: '80.00' },
    ]
    expect(projectsOf(reportEntries)).toEqual([
      { id: 8, name: 'Wartung', hourly_rate: '80.00' },
      { id: 7, name: 'Website', hourly_rate: '95.00' },
    ])
  })
})

describe('summarize with projects missing a rate', () => {
  const noRate = [{ id: 7, name: 'Website', hourly_rate: null }, { id: 8, name: 'Wartung' }]

  test('counts the hours of exact entries and an amount of 0', () => {
    const summary = summarize(entries, noRate)

    expect(summary.hours).toBe(5)
    expect(summary.amount).toBe(0)
  })

  test('takes the amount of the server for a rounded entry, whatever the project says', () => {
    const rounded = { id: 1, project_id: 7, start_time: '2026-09-21T09:00:00', end_time: '2026-09-21T09:20:00', billed_hours: '0.50', billed_amount: '0.00' }

    const summary = summarize([rounded], noRate)

    expect(summary.hours).toBe(0.5)
    expect(summary.amount).toBe(0)
  })
})

describe('summarize with a customer with mixed entries', () => {
  test('adds rounded and exact entries of one project: billed amounts plus exact hours x rate', () => {
    const mixed = [
      { id: 1, project_id: 7, start_time: '2026-09-21T09:00:00', end_time: '2026-09-21T10:05:00', billed_hours: '1.25', billed_amount: '118.75' },
      { id: 2, project_id: 7, start_time: '2026-09-22T09:00:00', end_time: '2026-09-22T10:00:00', billed_hours: null, billed_amount: null },
    ]

    const summary = summarize(mixed, projects)

    expect(summary.hours).toBe(2.25)
    expect(summary.amount).toBeCloseTo(118.75 + 95, 10)
    expect(summary.count).toBe(2)
  })
})
