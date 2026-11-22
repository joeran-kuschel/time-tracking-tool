// The app-wide options of the settings table: the name in the API, the column and a check for a valid value. This is
// the only place that knows the column names, so SQL never takes a column from a request (models/Settings.js builds
// it from this list). A new option is an entry here plus a migration that adds the column with its default. `fromColumn`
// (optional) turns what pg returns into the API value, e.g. the string of a DECIMAL column into a number.
// The steps in minutes; 0 is no rounding. The same list is in two database checks, which a migration that adds a step has to
// replace together: settings_rounding_minutes_check (007, 008) and customers_rounding_minutes_check (009). Tests fail when
// this list and a check disagree (settings.model.test.js, customer.model.test.js).
const ROUNDING_MINUTES = [0, 5, 10, 15, 30, 60];
const ROUNDING_DIRECTIONS = ['up', 'nearest'];
const WEEK_STARTS = ['monday', 'sunday'];
// The largest rate the column holds (DECIMAL(10, 2))
const MAX_RATE = 99999999.99;
// A rate in euros: a number from 0 with at most two decimals
// (the value must be within 1e-9 of its rounding to cents: float sums like 0.1 + 0.2 pass, 80.000000001 does not)
const isRate = (value) => Number.isFinite(value) && value >= 0 && value <= MAX_RATE && Math.abs(value - Math.round(value * 100) / 100) < 1e-9;

const OPTIONS = {
  // Whether reports start with hourly rates and amounts
  showAmounts: { column: 'show_amounts', isValid: (value) => typeof value === 'boolean' },
  // The step the hours of an entry are rounded to in reports: 0 (no rounding), 5, 10, 15, 30 or 60 minutes (utils/rounding.js)
  roundingMinutes: { column: 'rounding_minutes', isValid: (value) => ROUNDING_MINUTES.includes(value) },
  // Whether an entry is rounded 'up' or to the 'nearest' step
  roundingDirection: { column: 'rounding_direction', isValid: (value) => ROUNDING_DIRECTIONS.includes(value) },
  // Whether the Reports page and the PDF name the rounding rule in a sentence
  showRoundingNote: { column: 'show_rounding_note', isValid: (value) => typeof value === 'boolean' },
  // The day the weeks of the Dashboard and the Entries filters start on; months and reports stay calendar months
  weekStart: { column: 'week_start', isValid: (value) => WEEK_STARTS.includes(value) },
  // The hourly rate (euros) the form for a new project starts with; null is no default
  defaultHourlyRate: {
    column: 'default_hourly_rate',
    isValid: (value) => value === null || isRate(value),
    fromColumn: (value) => (value === null ? null : Number(value)),
  },
};

module.exports = OPTIONS;
