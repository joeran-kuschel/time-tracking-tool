const { DEFAULT_LOCALE } = require('../i18n');

// German spreadsheets expect ";" (their decimal separator is a comma), English ones ","
const DELIMITERS = { de: ';', en: ',' };
const BOM = '﻿';

// A text starting with one of these would be run as a formula by Excel and others: a single quote in front makes it plain text
const FORMULA_START = /^[=+\-@\t\r]/;

function field(cell, delimiter) {
  const value = 'number' in cell ? String(cell.number) : FORMULA_START.test(cell.text) ? `'${cell.text}` : cell.text;
  const needsQuotes = value.includes(delimiter) || /["\r\n]/.test(value);
  return needsQuotes ? `"${value.replaceAll('"', '""')}"` : value;
}

// { headers, rows } from reportRows as CSV text: UTF-8 with a BOM (so Excel reads umlauts), CRLF line ends.
// A number cell is written as it is; a text cell (headers included) is protected against formulas.
function toCsv({ headers, rows }, locale) {
  const delimiter = DELIMITERS[locale] ?? DELIMITERS[DEFAULT_LOCALE];
  const lines = [headers.map((text) => ({ text })), ...rows].map((cells) => cells.map((cell) => field(cell, delimiter)).join(delimiter));
  return BOM + lines.join('\r\n') + '\r\n';
}

module.exports = { toCsv };
