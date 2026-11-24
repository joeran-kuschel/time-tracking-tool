const { reportAmounts } = require('./amounts');
const { dayRange, parseTimeZone } = require('./period');
const { LOCALES } = require('../i18n');

// The rules of an invoice that need no database: reading the request, the lines and totals, and what is still missing.

// The longest period an invoice covers, in days
const MAX_DAYS = 366;
// The largest id of an INTEGER column
const MAX_ID = 2147483647;
// A record id from digits (a path parameter): a whole number from 1 that fits the column, so the database never has to refuse it
const isId = (text) => typeof text === 'string' && /^[1-9]\d{0,9}$/.test(text) && Number(text) <= MAX_ID;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

// 'YYYY-MM-DD' when the text is a real calendar day from the year 1970, otherwise null
function parseDay(text) {
  const match = typeof text === 'string' ? DAY.exec(text) : null;
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real && year >= 1970 ? text : null;
}

const daysBetween = (from, to) => (Date.parse(to) - Date.parse(from)) / 86400000;

// Today as 'YYYY-MM-DD' in the time zone
const today = (timeZone, now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

// The request body of a preview or a new invoice: { customerId, from, to, tz, invoiceDate (default: today in tz), lang,
// groupByTask (default false: round the hours once per day and task, see utils/tasks.js) }.
// Returns { value: { customerId, from, to, timeZone, invoiceDate, lang, groupByTask, range } } (range: the entries' time limits as
// ISO strings, see dayRange in utils/period.js), or { error } with the text of a 400.
function parseInvoiceRequest(body, now = new Date()) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return { error: 'The request must be an object' };
  const customerId = isId(body.customerId) ? Number(body.customerId) : body.customerId;
  if (!Number.isInteger(customerId) || customerId < 1 || customerId > MAX_ID) return { error: 'customerId is required' };
  const from = parseDay(body.from);
  const to = parseDay(body.to);
  if (!from || !to) return { error: 'from and to are required as YYYY-MM-DD' };
  if (from > to) return { error: 'from must not be after to' };
  if (daysBetween(from, to) + 1 > MAX_DAYS) return { error: `The period can be at most ${MAX_DAYS} days` };
  const timeZone = parseTimeZone(body.tz);
  const invoiceDate = body.invoiceDate === undefined ? today(timeZone, now) : parseDay(body.invoiceDate);
  if (!invoiceDate) return { error: 'invoiceDate must be YYYY-MM-DD' };
  const lang = LOCALES.includes(body.lang) ? body.lang : undefined;
  if (body.groupByTask !== undefined && typeof body.groupByTask !== 'boolean') return { error: 'groupByTask must be true or false' };
  const groupByTask = body.groupByTask === true;
  return { value: { customerId, from, to, timeZone, invoiceDate, lang, groupByTask, range: dayRange(from, to, timeZone) } };
}

// VAT in cents for a net amount in cents: net x rate / 100, halves up. A small business charges none.
const vatCentsOf = (netCents, { vatMode, vatRate }) => (vatMode === 'small_business' ? 0 : Math.round((netCents * vatRate) / 100));

// The lines and totals of an invoice from the entries of its period (with billed_hours when a rounding rule applies).
// One line per project, by name; a project without any counted time is left out. Each line is { projectId, name, minutes,
// rateCents, cents }, and the net is the sum of the lines, so the printed numbers add up exactly (utils/amounts.js).
function buildInvoice(entries, { vatMode, vatRate }) {
  const lines = reportAmounts(entries).projects
    .filter((project) => project.minutes > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'en') || a.projectId - b.projectId);
  const netCents = lines.reduce((sum, line) => sum + line.cents, 0);
  const vatCents = vatCentsOf(netCents, { vatMode, vatRate });
  return { lines, netCents, vatCents, grossCents: netCents + vatCents };
}

// Your details of the settings as the invoice has them
const senderOf = (settings) => ({
  name: settings.senderName, address: settings.senderAddress, email: settings.senderEmail, taxId: settings.senderTaxId, bankDetails: settings.senderBankDetails,
});

// What an invoice still needs, as codes: your name, address and tax ID, the customer's address, and counted time in the period
function missingDetails({ sender, customer, lineCount }) {
  return [
    !sender.name && 'senderName',
    !sender.address && 'senderAddress',
    !sender.taxId && 'senderTaxId',
    !customer.address && 'customerAddress',
    lineCount === 0 && 'noEntries',
  ].filter(Boolean);
}

// The name of the PDF: the number can hold / and spaces, which a file name should not
const invoiceFileName = (number, extension = 'pdf') => `invoice-${number.replace(/[^A-Za-z0-9._-]+/g, '_')}.${extension}`;

module.exports = { MAX_DAYS, isId, senderOf, parseDay, parseInvoiceRequest, vatCentsOf, buildInvoice, missingDetails, invoiceFileName };
