// The pattern of invoice numbers, set on the Settings page: text with the placeholders {YYYY} (year), {YY} (year of two
// digits), {MM} (month) and exactly one counter, a run of N such as {NNNN} (four digits, leading zeros). The rest is
// letters, digits and . _ / - or a space inside. The date is the invoice date. A pattern with a year starts counting at 1
// again every year, one without it keeps counting (the counters are in models/InvoiceCounter.js).
// The frontend has the same rules for its preview (frontend/src/invoiceNumber.js); both test files use the same table.
const MAX_PATTERN = 40;
const PLACEHOLDER = /\{(YYYY|YY|MM|N{1,8})\}/g;
const LITERAL = /^[A-Za-z0-9._/ -]*$/;

// null when the pattern is valid, otherwise a code that says what is wrong
function patternProblem(pattern) {
  if (typeof pattern !== 'string' || pattern === '' || pattern.length > MAX_PATTERN || pattern !== pattern.trim()) return 'text';
  if (!LITERAL.test(pattern.replace(PLACEHOLDER, ''))) return 'characters';
  const counters = [...pattern.matchAll(PLACEHOLDER)].filter(([, name]) => name.startsWith('N'));
  return counters.length === 1 ? null : 'counter';
}

const hasYear = (pattern) => /\{YY(YY)?\}/.test(pattern);

// The counter a number comes from: the year of the date for a pattern with a year, otherwise 0 (one counter for ever)
const counterScope = (pattern, date) => (hasYear(pattern) ? date.getUTCFullYear() : 0);

// The invoice number for a valid pattern, the counter value and a date (UTC)
function formatInvoiceNumber(pattern, number, date) {
  const year = String(date.getUTCFullYear());
  return pattern.replace(PLACEHOLDER, (_, name) => {
    if (name === 'YYYY') return year;
    if (name === 'YY') return year.slice(-2);
    if (name === 'MM') return String(date.getUTCMonth() + 1).padStart(2, '0');
    return String(number).padStart(name.length, '0');
  });
}

module.exports = { MAX_PATTERN, patternProblem, hasYear, counterScope, formatInvoiceNumber };
