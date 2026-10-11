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
