// The app-wide options of the settings table: the name in the API, the column and a check for a valid value. This is
// the only place that knows the column names, so SQL never takes a column from a request (models/Settings.js builds
// it from this list). A new option is an entry here plus a migration that adds the column with its default.
const OPTIONS = {
  // Whether reports start with hourly rates and amounts
  showAmounts: { column: 'show_amounts', isValid: (value) => typeof value === 'boolean' },
};

module.exports = OPTIONS;
