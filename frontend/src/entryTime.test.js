import { describe, expect, test } from 'vitest'
import { fromInputs, toDateInput, toTimeInput } from './entryTime'

describe('entry times', () => {
  test('date and time inputs round-trip through the stored ISO time', () => {
    const iso = fromInputs('2026-09-21', '08:30')
    expect(toDateInput(iso)).toBe('2026-09-21')
    expect(toTimeInput(iso)).toBe('08:30')
  })

  test('inputs are local time', () => {
    const local = new Date(2026, 2, 2, 23, 5)
    expect(fromInputs('2026-03-02', '23:05')).toBe(local.toISOString())
    expect(toDateInput(local)).toBe('2026-03-02')
    expect(toTimeInput(local)).toBe('23:05')
  })
})
