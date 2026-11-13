import { msg } from '@lingui/core/macro'
import { settingsGroups } from './settingsGroups'

// The rounding rule of a customer in its form: one choice from a single list. Values are 'global' (use the global
// setting: the customer has no rule of its own), 'none' (no rounding for this customer) and '<minutes>-<direction>',
// e.g. '15-up'. The steps are those of the setting "Round time entries" (settingsGroups.js), so a new step appears
// here too. The API has two fields, roundingMinutes and roundingDirection (see roundingFieldsOf).
const stepChoices = settingsGroups
  .flatMap((group) => group.options)
  .find((option) => option.name === 'roundingMinutes')
  .choices.filter((choice) => choice.value > 0)
const directionChoices = [
  { value: 'up', label: msg`Up` },
  { value: 'nearest', label: msg`To the nearest` },
]

export const GLOBAL_ROUNDING = 'global'

// The choices for a select: [{ value, label }], the global setting first, then no rounding, then every step with both
// directions ("Quarter hour (15 minutes), Up"). i18n translates the labels.
export function roundingOptions(i18n) {
  return [
    { value: GLOBAL_ROUNDING, label: i18n._(msg`Use the global setting`) },
    { value: 'none', label: i18n._(msg`No rounding`) },
    ...stepChoices.flatMap((step) => directionChoices.map((direction) => ({
      value: `${step.value}-${direction.value}`,
      label: `${i18n._(step.label)}, ${i18n._(direction.label)}`,
    }))),
  ]
}

// The choice that a customer record (rounding_minutes, rounding_direction from the API) has
export function roundingValueOf(customer) {
  if (customer?.rounding_minutes == null) return GLOBAL_ROUNDING
  if (customer.rounding_minutes === 0) return 'none'
  return `${customer.rounding_minutes}-${customer.rounding_direction}`
}

// The API fields of a choice: { roundingMinutes, roundingDirection }. Both null means "use the global setting"; no
// rounding is 0 minutes with the direction up (which is not used).
export function roundingFieldsOf(value) {
  if (value === GLOBAL_ROUNDING) return { roundingMinutes: null, roundingDirection: null }
  if (value === 'none') return { roundingMinutes: 0, roundingDirection: 'up' }
  const [minutes, direction] = value.split('-')
  return { roundingMinutes: Number(minutes), roundingDirection: direction }
}

// The label of a customer's own rule, or null when it uses the global setting
export function ownRoundingLabel(i18n, customer) {
  const value = roundingValueOf(customer)
  return value === GLOBAL_ROUNDING ? null : roundingOptions(i18n).find((option) => option.value === value)?.label ?? null
}
