import { describe, expect, test } from 'vitest'
import { i18n } from '@/i18n'
import { GLOBAL_ROUNDING, ownRoundingLabel, roundingFieldsOf, roundingOptions, roundingValueOf } from '@/customerRounding'
import { settingsGroups } from '@/settingsGroups'

describe('roundingOptions', () => {
  test('lists the global setting, no rounding and every step of the settings in both directions', () => {
    const steps = settingsGroups.flatMap((group) => group.options).find((option) => option.name === 'roundingMinutes').choices.map((c) => c.value).filter((m) => m > 0)

    expect(roundingOptions(i18n).map((option) => option.value)).toEqual([
      'global', 'none', ...steps.flatMap((minutes) => [`${minutes}-up`, `${minutes}-nearest`]),
    ])
  })

  test('has German labels in German and English labels in English', () => {
    expect(roundingOptions(i18n)[0].label).toBe('Globale Einstellung verwenden')
    expect(roundingOptions(i18n).find((o) => o.value === '15-up').label).toBe('Viertelstunde (15 Minuten), Aufrunden')
    i18n.activate('en')
    expect(roundingOptions(i18n)[0].label).toBe('Use the global setting')
    expect(roundingOptions(i18n).find((o) => o.value === '60-nearest').label).toBe('Hour (60 minutes), To the nearest')
  })
})

describe('roundingValueOf and roundingFieldsOf', () => {
  test.each([
    [{ rounding_minutes: null, rounding_direction: null }, 'global', { roundingMinutes: null, roundingDirection: null }],
    [{}, 'global', { roundingMinutes: null, roundingDirection: null }],
    [{ rounding_minutes: 0, rounding_direction: 'up' }, 'none', { roundingMinutes: 0, roundingDirection: 'up' }],
    [{ rounding_minutes: 5, rounding_direction: 'up' }, '5-up', { roundingMinutes: 5, roundingDirection: 'up' }],
    [{ rounding_minutes: 60, rounding_direction: 'nearest' }, '60-nearest', { roundingMinutes: 60, roundingDirection: 'nearest' }],
  ])('the customer %j is the choice %s and sends %j', (customer, value, fields) => {
    expect(roundingValueOf(customer)).toBe(value)
    expect(roundingFieldsOf(value)).toEqual(fields)
  })

  test('every choice survives the way to the API and back', () => {
    for (const { value } of roundingOptions(i18n)) {
      const { roundingMinutes, roundingDirection } = roundingFieldsOf(value)

      expect(roundingValueOf({ rounding_minutes: roundingMinutes, rounding_direction: roundingDirection })).toBe(value)
    }
  })

  test('works for a missing customer', () => {
    expect(roundingValueOf(undefined)).toBe(GLOBAL_ROUNDING)
    expect(roundingValueOf(null)).toBe(GLOBAL_ROUNDING)
  })
})

describe('ownRoundingLabel', () => {
  test('is null for a customer on the global setting and the label of an own rule', () => {
    expect(ownRoundingLabel(i18n, { rounding_minutes: null, rounding_direction: null })).toBeNull()
    expect(ownRoundingLabel(i18n, { rounding_minutes: 30, rounding_direction: 'nearest' })).toBe('Halbe Stunde (30 Minuten), Auf- oder abrunden (nächstgelegene Stufe)')
    expect(ownRoundingLabel(i18n, { rounding_minutes: 0, rounding_direction: 'up' })).toBe('Keine Rundung')
  })
})
