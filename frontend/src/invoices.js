// Small rules of the Invoices page, apart from the page itself. A day is a calendar day as 'YYYY-MM-DD' text (what the
// backend takes and gives, and what <input type="date"> holds), so days compare as text and no time zone is involved.

// The longest period an invoice covers, in days (the backend refuses more)
export const MAX_DAYS = 366

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/

// Whether the text is a real calendar day from the year 1970 (the backend does not take earlier ones)
export function isDay(text) {
  const match = DAY.exec(text ?? '')
  if (!match) return false
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return year >= 1970 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

const pad = (number) => String(number).padStart(2, '0')

// A date of the browser's clock as 'YYYY-MM-DD'
export const dayOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

// The whole month before the one of `today`: { from, to } (the first and the last day), the period an invoice starts with
export function previousMonth(today = new Date()) {
  const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const last = new Date(today.getFullYear(), today.getMonth(), 0)
  return { from: dayOf(first), to: dayOf(last) }
}

const daysBetween = (from, to) => (Date.parse(to) - Date.parse(from)) / 86400000

// What is wrong with a period, or null: 'days' (a day is missing or not a real day), 'order' (from is after to) or 'long'
// (more than MAX_DAYS days)
export function periodProblem(from, to) {
  if (!isDay(from) || !isDay(to)) return 'days'
  if (from > to) return 'order'
  return daysBetween(from, to) + 1 > MAX_DAYS ? 'long' : null
}

// The invoices of a customer whose period overlaps from..to (both included): the ones an invoice for this period could repeat.
// invoices: the list of the API ({ customerId, periodFrom, periodTo, ... })
export const overlappingInvoices = (invoices, customerId, from, to) =>
  invoices.filter((invoice) => invoice.customerId === customerId && invoice.periodFrom <= to && invoice.periodTo >= from)

// "05.03.2026" / "03/05/2026": a day in the language, as the day itself (UTC, so the browser's time zone never moves it)
export const formatInvoiceDay = (i18n, day) =>
  i18n.date(new Date(`${day}T00:00:00Z`), { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
