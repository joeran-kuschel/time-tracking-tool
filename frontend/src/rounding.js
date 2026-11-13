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

export const roundingNote = (rounding) => NOTES[`${rounding?.direction}-${rounding?.minutes}`] ?? null

// The rule the server applied to a list of entries: { minutes, direction } from the first entry that carries it
// (billed_rule, see the backend's utils/rounding.js), or null when the hours are not rounded. The notes under the billing
// figures name this rule, so they always match the figures.
export const roundingOfEntries = (entries) => entries?.find((entry) => entry.billed_rule)?.billed_rule ?? null
