const { i18n } = require('@lingui/core');
const { activateLocale } = require('../i18n');
const { calculateHours } = require('./hours');
const { reportAmounts, rateCentsOf } = require('./amounts');

// Hours, rates and amounts in the active language: the shared two-decimal number format without a unit, e.g. "1,50" / "1.50"
function formatDecimal(hours) {
  return i18n.number(Number(hours), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// sv-SE writes dates as YYYY-MM-DD and times as HH:mm, whatever the report's language
const dateInZone = (value, timeZone) =>
  new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(new Date(value));
const timeInZone = (value, timeZone) =>
  new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(new Date(value));

const text = (value) => ({ text: value ?? '' });
const number = (value) => ({ number: value });

// The one place that decides which columns an exported report has, for CSV now and other formats later.
// Returns { headers: string[], rows: Cell[][] } where a cell is { text } or { number } (a number already formatted
// for the language), so a format can treat them differently. Dates and times are in the browser's time zone.
// Translates synchronously right after activateLocale, see src/i18n.js.
// With amounts, the columns Rate (EUR/h) and Amount (EUR) follow the hours; the money rules are in utils/amounts.js.
function reportRows(entries, { customerName, locale, timeZone = 'UTC', amounts = false }) {
  activateLocale(locale);
  const headers = [
    i18n._({ id: 'report.date', message: 'Date' }),
    i18n._({ id: 'export.start', message: 'Start' }),
    i18n._({ id: 'export.end', message: 'End' }),
    i18n._({ id: 'export.customer', message: 'Customer' }),
    i18n._({ id: 'report.project', message: 'Project' }),
    i18n._({ id: 'report.description', message: 'Description' }),
    i18n._({ id: 'report.hours', message: 'Hours' }),
    ...(amounts ? [
      i18n._({ id: 'export.rate', message: 'Rate (EUR/h)' }),
      i18n._({ id: 'export.amount', message: 'Amount (EUR)' }),
    ] : []),
  ];
  const amountCents = amounts ? reportAmounts(entries).entryCents : [];
  const rows = entries.map((entry, index) => [
    text(dateInZone(entry.start_time, timeZone)),
    text(timeInZone(entry.start_time, timeZone)),
    text(entry.end_time ? timeInZone(entry.end_time, timeZone) : ''),
    text(customerName),
    text(entry.project_name),
    text(entry.description),
    number(formatDecimal(calculateHours(entry.start_time, entry.end_time))),
    ...(amounts ? [number(formatDecimal(rateCentsOf(entry) / 100)), number(formatDecimal(amountCents[index] / 100))] : []),
  ]);
  return { headers, rows };
}

module.exports = { formatDecimal, reportRows };
