// Locale-aware formatting of hours, amounts and times, shared by the time tracking page and the report.
export function hoursBetween(startTime, endTime) {
  if (!endTime) return 0
  return (new Date(endTime) - new Date(startTime)) / (1000 * 60 * 60)
}

export function formatHours(i18n, hours) {
  return `${i18n.number(Number(hours), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`
}

// "42 %" / "42%": the part's share of the total, 0 when the total is 0
export function formatShare(i18n, part, total) {
  const ratio = Number(total) > 0 ? Number(part) / Number(total) : 0
  return i18n.number(ratio, { style: 'percent', maximumFractionDigits: 0 })
}

export function formatAmount(i18n, amount) {
  return i18n.number(Number(amount), { style: 'currency', currency: 'EUR' })
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
