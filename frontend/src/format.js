// Locale-aware formatting of durations, amounts and times, shared by the time tracking page and the report.

// Whole minutes between start and end (half up, 30 seconds count as a minute); 0 for a running entry. Every duration
// of the app is counted in these, so rows add up exactly to their total.
export function minutesBetween(startTime, endTime) {
  if (!endTime) return 0
  return roundMinutes((new Date(endTime) - new Date(startTime)) / 60000)
}

// Minutes as a whole number, halves away from zero like ROUND() of the database
export const roundMinutes = (minutes) => Math.sign(minutes) * Math.round(Math.abs(minutes)) || 0

// The minutes of decimal hours from the server (billed_hours, hours of a search)
export const minutesOfHours = (hours) => roundMinutes(Number(hours) * 60)

// The minutes a report counts for an entry, the same as the backend's reportMinutes (utils/hours.js): the rounded
// billed_hours the server sends when a rounding rule is set, otherwise the whole minutes between start and end
export const entryMinutes = (entry) => (entry.billed_hours != null ? minutesOfHours(entry.billed_hours) : minutesBetween(entry.start_time, entry.end_time))

// "3:59 h", "0:05 h", "123:45 h", "-1:30 h": hours without limit, minutes with two digits, the same in both languages
export function formatDuration(i18n, minutes) {
  const whole = roundMinutes(Number(minutes))
  const abs = Math.abs(whole)
  return `${whole < 0 ? '-' : ''}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')} h`
}

// "PT3H59M", the machine-readable form of a duration for <time datetime>; null for a negative one (not valid there)
export function isoDuration(minutes) {
  const whole = roundMinutes(Number(minutes))
  return whole < 0 ? null : `PT${Math.floor(whole / 60)}H${whole % 60}M`
}

// "42 %" / "42%": the part's share of the total, 0 when the total is 0
export function formatShare(i18n, part, total) {
  const ratio = Number(total) > 0 ? Number(part) / Number(total) : 0
  return i18n.number(ratio, { style: 'percent', maximumFractionDigits: 0 })
}

export function formatAmount(i18n, amount) {
  return i18n.number(Number(amount), { style: 'currency', currency: 'EUR' })
}

// A number with two decimals and no currency, as typed into a field: "80,00" / "80.00"
export function formatDecimal(i18n, value) {
  return i18n.number(Number(value), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Reads what formatDecimal shows: digits with at most one decimal separator of the active language and at most two
// decimals (no sign, no thousands separator). '' is null (nothing entered), a valid text is its number, anything else is
// undefined. The largest value is what the database holds for a rate (DECIMAL(10, 2)).
export function parseDecimal(i18n, text) {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const separator = i18n.number(1.1, { minimumFractionDigits: 1 }).replace(/\d/g, '')[0]
  const pattern = new RegExp(`^\\d{1,8}(?:\\${separator}\\d{1,2})?$`)
  if (!pattern.test(trimmed)) return undefined
  return Number(trimmed.replace(separator, '.'))
}

export function formatRate(i18n, rate) {
  return `${formatAmount(i18n, rate)}/h`
}

// "Mon, Sep 21" / "Mo., 21. Sept."
export function formatDay(i18n, time) {
  return i18n.date(time, { weekday: 'short', day: 'numeric', month: 'short' })
}

// "09:30" in both languages
export function formatClock(i18n, time) {
  return i18n.date(time, { hour: '2-digit', minute: '2-digit', hour12: false })
}
