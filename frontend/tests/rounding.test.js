import { describe, expect, test } from 'vitest'
import { roundingNote, roundingOfEntries } from '@/rounding'

describe('roundingNote', () => {
  test.each([
    [{ minutes: 15, direction: 'up' }, 'Hours rounded up to quarter hours.'],
    [{ minutes: 30, direction: 'up' }, 'Hours rounded up to half hours.'],
    [{ minutes: 15, direction: 'nearest' }, 'Hours rounded to the nearest quarter hour.'],
    [{ minutes: 30, direction: 'nearest' }, 'Hours rounded to the nearest half hour.'],
  ])('names the rule %j', (rounding, sentence) => {
    expect(roundingNote(rounding).message).toBe(sentence)
  })

  test.each([[undefined], [null], [{}], [{ minutes: 20, direction: 'up' }], [{ minutes: 15, direction: 'down' }]])(
    'names no rule for %j', (rounding) => {
      expect(roundingNote(rounding)).toBeNull()
    }
  )
})

describe('roundingOfEntries', () => {
  const rule = { minutes: 15, direction: 'up' }

  test('takes the rule the server applied from the entries', () => {
    expect(roundingOfEntries([{ id: 1, billed_hours: '1.25', billed_rule: rule }, { id: 2, billed_hours: '0.50', billed_rule: rule }])).toEqual(rule)
  })

  test('finds it on any entry, also when the first is a running one', () => {
    expect(roundingOfEntries([{ id: 1, billed_hours: null, billed_rule: rule }])).toEqual(rule)
    expect(roundingOfEntries([{ id: 1 }, { id: 2, billed_rule: rule }])).toEqual(rule)
  })

  test.each([[[]], [[{ id: 1 }]], [[{ id: 1, billed_rule: null }]], [null], [undefined]])('is null for %j (no rounding)', (entries) => {
    expect(roundingOfEntries(entries)).toBeNull()
  })

  test('gives a rule that roundingNote can name', () => {
    expect(roundingNote(roundingOfEntries([{ billed_rule: rule }])).message).toBe('Hours rounded up to quarter hours.')
  })
})
