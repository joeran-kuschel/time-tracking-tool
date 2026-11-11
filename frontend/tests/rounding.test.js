import { describe, expect, test } from 'vitest'
import { roundingNote } from '@/rounding'

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
