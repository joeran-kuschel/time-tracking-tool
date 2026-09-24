// Month and year as numbers, or null when they are missing or out of range
function parseMonth(month, year) {
  const m = Number(month);
  const y = Number(year);
  return Number.isInteger(m) && m >= 1 && m <= 12 && Number.isInteger(y) && y >= 1970 ? { month: m, year: y } : null;
}

// The month before { month, year }
function previousMonth({ month, year }) {
  return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
}

module.exports = { parseMonth, previousMonth };
