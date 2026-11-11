import { msg } from '@lingui/core/macro'

// The sentence that names the rounding rule of a report ({ minutes, direction } from the report, see
// backend utils/rounding.js), as a msg descriptor to translate with i18n._
const NOTES = {
  'up-15': msg`Hours rounded up to quarter hours.`,
  'up-30': msg`Hours rounded up to half hours.`,
  'nearest-15': msg`Hours rounded to the nearest quarter hour.`,
  'nearest-30': msg`Hours rounded to the nearest half hour.`,
}

export const roundingNote = (rounding) => NOTES[`${rounding?.direction}-${rounding?.minutes}`] ?? null
