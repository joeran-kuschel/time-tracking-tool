import { describe, expect, test } from 'vitest'
import { roundingNote, roundingOfEntries } from '@/rounding'
import { settingsGroups } from '@/settingsGroups'

describe('roundingNote', () => {
  test.each([
    [{ minutes: 15, direction: 'up' }, 'Hours rounded up to quarter hours.'],
    [{ minutes: 30, direction: 'up' }, 'Hours rounded up to half hours.'],
    [{ minutes: 15, direction: 'nearest' }, 'Hours rounded to the nearest quarter hour.'],
    [{ minutes: 30, direction: 'nearest' }, 'Hours rounded to the nearest half hour.'],
    [{ minutes: 60, direction: 'up' }, 'Hours rounded up to full hours.'],
    [{ minutes: 60, direction: 'nearest' }, 'Hours rounded to the nearest full hour.'],
    [{ minutes: 5, direction: 'up' }, 'Hours rounded up to steps of 5 minutes.'],
    [{ minutes: 10, direction: 'up' }, 'Hours rounded up to steps of 10 minutes.'],
    [{ minutes: 5, direction: 'nearest' }, 'Hours rounded to the nearest 5 minutes.'],
    [{ minutes: 10, direction: 'nearest' }, 'Hours rounded to the nearest 10 minutes.'],
  ])('names the rule %j', (rounding, sentence) => {
    expect(roundingNote(rounding).message).toBe(sentence)
  })

  test.each([[undefined], [null], [{}], [{ minutes: 20, direction: 'up' }], [{ minutes: 45, direction: 'nearest' }], [{ minutes: 15, direction: 'down' }]])(
    'names no rule for %j', (rounding) => {
      expect(roundingNote(rounding)).toBeNull()
    }
  )
})

describe('roundingOfEntries', () => {
  const rule = { minutes: 15, direction: 'up' }
  const other = { minutes: 60, direction: 'nearest' }
  const done = (extra) => ({ end_time: '2026-09-21T10:00:00', ...extra })

  test('takes the rule the server applied from the finished entries', () => {
    expect(roundingOfEntries([done({ billed_hours: '1.25', billed_rule: rule }), done({ billed_hours: '0.50', billed_rule: rule })])).toEqual(rule)
  })

  test('counts finished entries only, like the figures: a running entry does not count', () => {
    expect(roundingOfEntries([{ id: 1, billed_hours: null, billed_rule: rule }])).toBeNull()
    expect(roundingOfEntries([{ id: 1, billed_rule: other }, done({ billed_rule: rule })])).toEqual(rule)
  })

  test('says the rounding is mixed when customers have different rules', () => {
    expect(roundingOfEntries([done({ billed_rule: rule }), done({ billed_rule: other })])).toEqual({ mixed: true })
  })

  test('says it is mixed when the rules differ only in the direction', () => {
    expect(roundingOfEntries([done({ billed_rule: rule }), done({ billed_rule: { ...rule, direction: 'nearest' } })])).toEqual({ mixed: true })
  })

  test('does not mutate the entries', () => {
    const entries = [done({ billed_rule: rule }), done({ billed_rule: other })]
    const copy = JSON.parse(JSON.stringify(entries))

    roundingOfEntries(entries)

    expect(entries).toEqual(copy)
  })

  test('says it is mixed when one customer is rounded and another is exact', () => {
    expect(roundingOfEntries([done({ billed_rule: rule }), done({ billed_rule: null })])).toEqual({ mixed: true })
  })

  test('is null when the entries are exact: no rule field, or all customers without a rule', () => {
    expect(roundingOfEntries([done({ id: 1 }), done({ id: 2 })])).toBeNull()
    expect(roundingOfEntries([done({ billed_rule: null }), done({ billed_rule: null })])).toBeNull()
  })

  test.each([[[]], [null], [undefined]])('is null for %j', (entries) => {
    expect(roundingOfEntries(entries)).toBeNull()
  })

  test('gives a rule that roundingNote can name', () => {
    expect(roundingNote(roundingOfEntries([done({ billed_rule: rule })])).message).toBe('Hours rounded up to quarter hours.')
  })

  test('gives a note for mixed rules', () => {
    expect(roundingNote(roundingOfEntries([done({ billed_rule: rule }), done({ billed_rule: other })])).message).toBe('Rounding differs by customer.')
  })
})

// A step offered in the settings needs a sentence, or the Reports page and the notes under the billing figures would
// say nothing about it
describe('every rounding step offered in the settings has a sentence', () => {
  const choices = settingsGroups.flatMap((group) => group.options).find((option) => option.name === 'roundingMinutes').choices
  const steps = choices.map((choice) => choice.value).filter((minutes) => minutes > 0)

  test('lists the steps of the settings', () => {
    expect(steps).toEqual([5, 10, 15, 30, 60])
  })

  test.each(steps.flatMap((minutes) => ['up', 'nearest'].map((direction) => [minutes, direction])))('%s minutes, %s', (minutes, direction) => {
    const note = roundingNote({ minutes, direction })

    expect(note).not.toBeNull()
    expect(note.message).toMatch(/^Hours rounded/)
  })
})
