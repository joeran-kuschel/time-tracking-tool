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

    expect(summary.minutes).toBe(300)
    expect(summary.amount).toBe(3.5 * 95 + 1.5 * 80)
    expect(summary.count).toBe(2)
    expect(summary.projects.map((p) => [p.project.name, p.minutes])).toEqual([['Website', 210], ['Wartung', 90]])
  })

  test('is empty without entries', () => {
    expect(summarize([], projects)).toEqual({ minutes: 0, amount: 0, count: 0, projects: [] })
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

    expect(summary.minutes).toBe(105)
    expect(summary.amount).toBeCloseTo(158.75, 10)
    expect(summary.count).toBe(2)
    expect(summary.projects.map((p) => [p.project.name, p.minutes, p.amount])).toEqual([['Website', 75, 118.75], ['Wartung', 30, 40]])
  })

  test('uses the amounts of the server, rounded to cents per entry like the report, not hours x rate of the sum', () => {
    // 0.25 h at 33.33 is 8.3325: the report counts 8.33 for each of the three entries, 24.99 in all, not 25.00
    const project = [{ id: 7, name: 'Web', hourly_rate: '33.33' }]
    const three = [1, 2, 3].map((id) => ({
      id, project_id: 7, start_time: `2026-09-0${id}T09:00:00`, end_time: `2026-09-0${id}T09:07:00`, billed_hours: '0.25', billed_amount: '8.33',
    }))

    const summary = summarize(three, project)

    expect(summary.minutes).toBe(45)
    expect(summary.amount).toBeCloseTo(24.99, 10)
  })

  test('counts an entry without billed hours as before, next to rounded ones', () => {
    const backwards = { id: 3, project_id: 7, start_time: '2026-09-22T12:00:00', end_time: '2026-09-22T11:00:00', billed_hours: null, billed_amount: null }

    const summary = summarize([...rounded, backwards], projects)

    expect(summary.projects.map((p) => [p.project.name, p.minutes])).toEqual([['Website', 15], ['Wartung', 30]])
    expect(summary.amount).toBeCloseTo(118.75 - 95 + 40, 10)
  })

  test('leaves a running entry out, whatever it carries', () => {
    const running = { id: 4, project_id: 7, start_time: '2026-09-22T10:00:00', end_time: null, billed_hours: null, billed_amount: null }

    const summary = summarize([...rounded, running], projects)

    expect(summary.count).toBe(2)
    expect(summary.minutes).toBe(105)
  })

  test('without billed fields the figures are exactly as before', () => {
    const before = summarize(entries, projects)

    expect(before.minutes).toBe(300)
    expect(before.amount).toBe(3.5 * 95 + 1.5 * 80)
  })

  test('an entry with only one of the two billed values counts as exact, so hours and amount never disagree', () => {
    const onlyHours = { ...rounded[0], billed_amount: undefined }
    const onlyAmount = { ...rounded[1], billed_hours: null }

    const summary = summarize([onlyHours, onlyAmount], projects)

    // 65 min and 20 min at their project's rate, exact
    expect(summary.minutes).toBe(65 + 20)
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

    expect(summary.minutes).toBe(300)
    expect(summary.amount).toBe(0)
  })

  test('takes the amount of the server for a rounded entry, whatever the project says', () => {
    const rounded = { id: 1, project_id: 7, start_time: '2026-09-21T09:00:00', end_time: '2026-09-21T09:20:00', billed_hours: '0.50', billed_amount: '0.00' }

    const summary = summarize([rounded], noRate)

    expect(summary.minutes).toBe(30)
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

    expect(summary.minutes).toBe(135)
    expect(summary.amount).toBeCloseTo(118.75 + 95, 10)
    expect(summary.count).toBe(2)
  })
})

describe('summarize in whole minutes', () => {
  const project = [{ id: 7, name: 'Website', hourly_rate: '60.00' }]
  const billed = (id, hours) => ({ id, project_id: 7, start_time: '2026-09-21T09:00:00', end_time: '2026-09-21T09:03:00', billed_hours: hours, billed_amount: '1.00' })

  test('six entries rounded to 10 minutes (billed 0.17 h) add up to 60 minutes', () => {
    expect(summarize([1, 2, 3, 4, 5, 6].map((id) => billed(id, '0.17')), project).minutes).toBe(60)
  })

  test('twelve entries rounded to 5 minutes (billed 0.08 h) add up to 60 minutes', () => {
    expect(summarize(Array.from({ length: 12 }, (_, i) => billed(i + 1, '0.08')), project).minutes).toBe(60)
  })

  test('exact entries count whole minutes each, so the rows add up to the total', () => {
    // 30 s count as a minute, 29 s as none: 1 + 0 + 2 = 3, not 1.4 rounded in the end
    const at = (id, end) => ({ id, project_id: 7, start_time: '2026-09-21T09:00:00', end_time: end })
    const summary = summarize([at(1, '2026-09-21T09:00:30'), at(2, '2026-09-21T09:00:29'), at(3, '2026-09-21T09:01:30')], project)

    expect(summary.minutes).toBe(3)
    expect(summary.projects[0].minutes).toBe(summary.minutes)
  })

  test('leaves out a project whose entries are all under 30 seconds', () => {
    const short = { id: 1, project_id: 7, start_time: '2026-09-21T09:00:00', end_time: '2026-09-21T09:00:20' }

    expect(summarize([short], project)).toMatchObject({ minutes: 0, projects: [] })
  })
})
