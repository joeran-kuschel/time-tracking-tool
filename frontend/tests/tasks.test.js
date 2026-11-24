import { describe, expect, test } from 'vitest'
import { MAX_TASK, tasksOf } from '@/tasks'

const entry = (project_id, task, start_time) => ({ project_id, task, start_time })

describe('tasksOf', () => {
  test('lists the tasks of the project, the most recently worked on first', () => {
    const entries = [entry(7, 'Old', '2026-11-20T09:00:00Z'), entry(7, 'New', '2026-11-24T09:00:00Z'), entry(7, 'Middle', '2026-11-22T09:00:00Z')]

    expect(tasksOf(entries, 7)).toEqual(['New', 'Middle', 'Old'])
  })

  test('lists a task once, whatever its case and spaces', () => {
    const entries = [entry(7, 'Fix login', '2026-11-24T09:00:00Z'), entry(7, ' fix LOGIN ', '2026-11-22T09:00:00Z')]

    expect(tasksOf(entries, 7)).toEqual(['Fix login'])
  })

  test('leaves out other projects and entries without a task, and does not change the list it is given', () => {
    const entries = [entry(8, 'Elsewhere', '2026-11-24T09:00:00Z'), entry(7, null, '2026-11-23T09:00:00Z'), entry(7, 'Mine', '2026-11-22T09:00:00Z')]
    const copy = [...entries]

    expect(tasksOf(entries, 7)).toEqual(['Mine'])
    expect(entries).toEqual(copy)
  })

  test('is empty without a project', () => {
    expect(tasksOf([entry(7, 'Mine', '2026-11-22T09:00:00Z')], undefined)).toEqual([])
  })

  test('has the same limit as the backend', () => {
    expect(MAX_TASK).toBe(100)
  })
})
