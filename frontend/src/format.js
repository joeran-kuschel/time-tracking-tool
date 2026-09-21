// Locale-aware formatting of hours and rates, shared by the entry list and the report.
export function hoursBetween(startTime, endTime) {
  if (!endTime) return 0
  return (new Date(endTime) - new Date(startTime)) / (1000 * 60 * 60)
}

export function formatHours(i18n, hours) {
  return `${i18n.number(Number(hours), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`
}

export function formatRate(i18n, rate) {
  return `${i18n.number(Number(rate), { style: 'currency', currency: 'EUR' })}/h`
}
