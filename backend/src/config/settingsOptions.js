// The app-wide options of the settings table: the name in the API, the column and a check for a valid value. This is
// the only place that knows the column names, so SQL never takes a column from a request (models/Settings.js builds
// it from this list). A new option is an entry here plus a migration that adds the column with its default.
const ROUNDING_MINUTES = [0, 15, 30];
const ROUNDING_DIRECTIONS = ['up', 'nearest'];

const OPTIONS = {
  // Whether reports start with hourly rates and amounts
  showAmounts: { column: 'show_amounts', isValid: (value) => typeof value === 'boolean' },
  // The step the hours of an entry are rounded to in reports: 0 (no rounding), 15 or 30 minutes (utils/rounding.js)
  roundingMinutes: { column: 'rounding_minutes', isValid: (value) => ROUNDING_MINUTES.includes(value) },
  // Whether an entry is rounded 'up' or to the 'nearest' step
  roundingDirection: { column: 'rounding_direction', isValid: (value) => ROUNDING_DIRECTIONS.includes(value) },
  // Whether the Reports page and the PDF name the rounding rule in a sentence
  showRoundingNote: { column: 'show_rounding_note', isValid: (value) => typeof value === 'boolean' },
};

module.exports = OPTIONS;
