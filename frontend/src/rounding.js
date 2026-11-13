import { msg } from '@lingui/core/macro'

// The sentence that names the rounding rule of a report ({ minutes, direction } from the report, see
// backend utils/rounding.js), as a msg descriptor to translate with i18n._
const NOTES = {
  'up-5': msg`Hours rounded up to steps of 5 minutes.`,
  'up-10': msg`Hours rounded up to steps of 10 minutes.`,
  'up-15': msg`Hours rounded up to quarter hours.`,
  'up-30': msg`Hours rounded up to half hours.`,
  'up-60': msg`Hours rounded up to full hours.`,
  'nearest-5': msg`Hours rounded to the nearest 5 minutes.`,
  'nearest-10': msg`Hours rounded to the nearest 10 minutes.`,
  'nearest-15': msg`Hours rounded to the nearest quarter hour.`,
  'nearest-30': msg`Hours rounded to the nearest half hour.`,
  'nearest-60': msg`Hours rounded to the nearest full hour.`,
}

const MIXED = msg`Rounding differs by customer.`

export const roundingNote = (rounding) => (rounding?.mixed ? MIXED : NOTES[`${rounding?.direction}-${rounding?.minutes}`] ?? null)

// The rule the server applied to the figures made of a list of entries: { minutes, direction } when all counted entries
// share one rule, { mixed: true } when customers differ, null when nothing is rounded. Each entry carries billed_rule
// (see the backend's utils/rounding.js: the rule of its customer, or null when none applies); only finished entries are
// counted, like the figures. The notes under the billing figures name this rule, so they always match the figures.
export function roundingOfEntries(entries) {
  const rules = new Set()
  for (const entry of entries ?? []) {
    if (entry.end_time && 'billed_rule' in entry) rules.add(JSON.stringify(entry.billed_rule ?? null))
  }
  if (rules.size === 0) return null
  if (rules.size === 1) return JSON.parse([...rules][0])
  return { mixed: true }
}
