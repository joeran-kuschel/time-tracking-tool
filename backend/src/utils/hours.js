// The exact hours between two times, not rounded
const exactHours = (startTime, endTime) => (new Date(endTime) - new Date(startTime)) / (1000 * 60 * 60);

// Hours of an entry as a string with two decimals; a running entry has no end yet and counts as 0
function calculateHours(startTime, endTime) {
  if (!endTime) return 0;
  return exactHours(startTime, endTime).toFixed(2);
}

// The hours a report counts for an entry: the rounded hours when a rounding rule was applied (billed_hours, see
// utils/rounding.js), otherwise the exact ones
function reportHours(entry) {
  return entry.billed_hours ?? calculateHours(entry.start_time, entry.end_time);
}

module.exports = { calculateHours, exactHours, reportHours };
