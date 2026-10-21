const { i18n } = require('@lingui/core');
const { activateLocale } = require('../i18n');

// Hours of an entry as a string with two decimals; a running entry has no end yet and counts as 0
function calculateHours(startTime, endTime) {
  if (!endTime) return 0;
  const diff = new Date(endTime) - new Date(startTime);
  return (diff / (1000 * 60 * 60)).toFixed(2);
}

// Hours in the active language without the unit, e.g. "1,50" / "1.50"
function formatHoursNumber(hours) {
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
function reportRows(entries, { customerName, locale, timeZone = 'UTC' }) {
  activateLocale(locale);
  const headers = [
    i18n._({ id: 'report.date', message: 'Date' }),
    i18n._({ id: 'export.start', message: 'Start' }),
    i18n._({ id: 'export.end', message: 'End' }),
    i18n._({ id: 'export.customer', message: 'Customer' }),
    i18n._({ id: 'report.project', message: 'Project' }),
    i18n._({ id: 'report.description', message: 'Description' }),
    i18n._({ id: 'report.hours', message: 'Hours' }),
  ];
  const rows = entries.map((entry) => [
    text(dateInZone(entry.start_time, timeZone)),
    text(timeInZone(entry.start_time, timeZone)),
    text(entry.end_time ? timeInZone(entry.end_time, timeZone) : ''),
    text(customerName),
    text(entry.project_name),
    text(entry.description),
    number(formatHoursNumber(calculateHours(entry.start_time, entry.end_time))),
  ]);
  return { headers, rows };
}

module.exports = { calculateHours, formatHoursNumber, reportRows };
