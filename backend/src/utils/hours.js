// The duration of an entry as a report counts it, in whole minutes. Every duration of a report is counted in these, so the
// printed rows add up exactly to their total. The frontend does the same (frontend/src/format.js).

// Halves away from zero, like ROUND() of the database; never -0
const roundMinutes = (minutes) => Math.sign(minutes) * Math.round(Math.abs(minutes)) || 0;

// The minutes a report counts for an entry: the rounded hours when a rounding rule was applied (billed_hours, see
// utils/rounding.js, always a whole number of minutes), otherwise the time between start and end rounded to a whole
// minute (half up). A running entry counts 0; an entry that ends before it starts keeps its negative minutes.
function reportMinutes(entry) {
  if (entry.billed_hours != null) return roundMinutes(Number(entry.billed_hours) * 60);
  if (!entry.end_time) return 0;
  return roundMinutes((new Date(entry.end_time) - new Date(entry.start_time)) / 60000);
}

// Decimal hours with two decimals, for the JSON report (it is data, not display)
const minutesToHours = (minutes) => (minutes / 60).toFixed(2);

// "3:59 h", "0:05 h", "-1:30 h": hours without limit, minutes with two digits, the same in every language
function formatDuration(minutes) {
  const whole = roundMinutes(minutes);
  const abs = Math.abs(whole);
  return `${whole < 0 ? '-' : ''}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')} h`;
}

module.exports = { roundMinutes, reportMinutes, minutesToHours, formatDuration };
