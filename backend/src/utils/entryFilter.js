const { parseTimeZone, dayRange } = require('./period');

const MAX_SEARCH_LENGTH = 200;
const MAX_ID = 2147483647; // largest value of a Postgres integer column
// Years the dates may have: dayRange adds a day to `to`, and Postgres rejects years beyond 9999 (and ISO years with a sign)
const MIN_YEAR = 1000;
const MAX_YEAR = 9998;
const SORTS = ['newest', 'oldest'];

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const POSITIVE_INTEGER = /^[1-9]\d*$/;

// A query value that was sent once and is not empty, or undefined
const given = (value) => (value === '' ? undefined : value);

// A real calendar date in the form YYYY-MM-DD (2026-02-30 is not one) in the years MIN_YEAR to MAX_YEAR
function isDate(value) {
  if (typeof value !== 'string' || !DATE_FORMAT.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const isId = (value) => typeof value === 'string' && POSITIVE_INTEGER.test(value) && Number(value) <= MAX_ID;

// Reads the filter of the entry search from a query string (all parameters are optional):
// q (text in the description), customerId, projectId, from and to (YYYY-MM-DD in the browser's time zone, to
// included), tz (IANA time zone, unknown ones fall back to UTC) and sort (newest or oldest).
// Returns { filter } with from and to as ISO instants (see dayRange in period.js), or { error } for a bad value.
function parseEntryFilter(query) {
  const { customerId, projectId, from, to, sort = 'newest' } = Object.fromEntries(
    Object.entries(query).map(([key, value]) => [key, given(value)])
  );
  const q = given(query.q);

  if (q !== undefined && (typeof q !== 'string' || q.trim().length > MAX_SEARCH_LENGTH)) {
    return { error: `q must be text of at most ${MAX_SEARCH_LENGTH} characters` };
  }
  for (const [name, value] of [['customerId', customerId], ['projectId', projectId]]) {
    if (value !== undefined && !isId(value)) return { error: `${name} must be a positive integer` };
  }
  for (const [name, value] of [['from', from], ['to', to]]) {
    if (value !== undefined && !isDate(value)) return { error: `${name} must be a date (YYYY-MM-DD)` };
  }
  if (from !== undefined && to !== undefined && from > to) {
    return { error: 'from must not be after to' };
  }
  if (!SORTS.includes(sort)) {
    return { error: `sort must be one of: ${SORTS.join(', ')}` };
  }

  return {
    filter: {
      q: q?.trim() || undefined,
      customerId: customerId === undefined ? undefined : Number(customerId),
      projectId: projectId === undefined ? undefined : Number(projectId),
      ...dayRange(from, to, parseTimeZone(query.tz)),
      sort,
    },
  };
}

module.exports = { parseEntryFilter, MAX_SEARCH_LENGTH };
