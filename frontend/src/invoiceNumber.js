// The pattern of invoice numbers (Settings page) and the preview of the next number. The rules are those of the backend's
// utils/invoiceNumber.js, which makes the real numbers; both test files use the same table. A pattern is text with the
// placeholders {YYYY} (year), {YY} (year of two digits), {MM} (month) and exactly one counter, a run of N such as {NNNN};
// the rest is letters, digits and . _ / - or a space inside. Dates are UTC, like the backend's.
export const MAX_PATTERN = 40
export const MAX_INVOICE_NUMBER = 99999999
const PLACEHOLDER = /\{(YYYY|YY|MM|N{1,8})\}/g
const LITERAL = /^[A-Za-z0-9._/ -]*$/

// null when the pattern is valid, otherwise what is wrong: 'text' (empty, too long, space at the ends),
// 'characters' (a character or a placeholder that is not allowed) or 'counter' (not exactly one counter)
export function patternProblem(pattern) {
  if (typeof pattern !== 'string' || pattern === '' || pattern.length > MAX_PATTERN || pattern !== pattern.trim()) return 'text'
  if (!LITERAL.test(pattern.replace(PLACEHOLDER, ''))) return 'characters'
  const counters = [...pattern.matchAll(PLACEHOLDER)].filter(([, name]) => name.startsWith('N'))
  return counters.length === 1 ? null : 'counter'
}

// The invoice number for a valid pattern, the counter value and a date
export function formatInvoiceNumber(pattern, number, date) {
  const year = String(date.getUTCFullYear())
  return pattern.replace(PLACEHOLDER, (_, name) => {
    if (name === 'YYYY') return year
    if (name === 'YY') return year.slice(-2)
    if (name === 'MM') return String(date.getUTCMonth() + 1).padStart(2, '0')
    return String(number).padStart(name.length, '0')
  })
}

// A whole number from 1 to MAX_INVOICE_NUMBER typed as digits, or undefined (also for a number that is given as a number)
export function parseInvoiceNumber(value) {
  const text = String(value ?? '').trim()
  const number = /^\d{1,8}$/.test(text) ? Number(text) : NaN
  return number >= 1 && number <= MAX_INVOICE_NUMBER ? number : undefined
}

// The preview under the "next number" field, from what the form shows now (typed text or saved values), or null while
// the pattern or the number cannot be used yet
export function previewInvoiceNumber(values, now = new Date()) {
  const pattern = (values.invoiceNumberPattern ?? '').trim()
  const number = parseInvoiceNumber(values.invoiceNextNumber)
  return patternProblem(pattern) === null && number !== undefined ? formatInvoiceNumber(pattern, number, now) : null
}
