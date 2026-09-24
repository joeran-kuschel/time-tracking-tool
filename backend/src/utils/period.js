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

// The month after { month, year }
function nextMonth({ month, year }) {
  return month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };
}

// The browser's IANA time zone (e.g. "Europe/Berlin"), or UTC when it is missing or unknown
function parseTimeZone(value) {
  if (typeof value !== 'string' || !value) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    return 'UTC';
  }
}

// How far the time zone's clock is ahead of UTC at the given instant, in milliseconds
function zoneOffset(instant, timeZone) {
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  });
  const parts = Object.fromEntries(format.formatToParts(instant).map((part) => [part.type, Number(part.value)]));
  const wallClock = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wallClock - Math.floor(instant.getTime() / 1000) * 1000;
}

// Midnight on the first of the month in the time zone, as a UTC instant.
// The second step corrects the offset when it differs between the guess and the result (daylight saving time).
function startOfMonth({ month, year }, timeZone) {
  const wallClock = Date.UTC(year, month - 1, 1);
  const guess = wallClock - zoneOffset(new Date(wallClock), timeZone);
  return new Date(wallClock - zoneOffset(new Date(guess), timeZone));
}

// The month in the time zone as ISO strings: entries belong to it when from <= start_time < to
function monthRange(period, timeZone) {
  return {
    from: startOfMonth(period, timeZone).toISOString(),
    to: startOfMonth(nextMonth(period), timeZone).toISOString(),
  };
}

module.exports = { parseMonth, previousMonth, nextMonth, parseTimeZone, monthRange };
