const { create: contentDisposition } = require('content-disposition');
const Invoice = require('../models/Invoice');
const InvoiceCounter = require('../models/InvoiceCounter');
const Customer = require('../models/Customer');
const TimeEntry = require('../models/TimeEntry');
const Settings = require('../models/Settings');
const Logo = require('../models/Logo');
const { DEFAULT_LOCALE } = require('../i18n');
const { roundingRuleOf, withBilledHours } = require('../utils/rounding');
const { groupByTask } = require('../utils/tasks');
const { isId, senderOf, parseInvoiceRequest, buildInvoice, missingDetails, invoiceFileName } = require('../utils/invoicing');
const { counterScope, formatInvoiceNumber } = require('../utils/invoiceNumber');
const { generateInvoicePDF } = require('../utils/invoicePdf');
const { decimal, CURRENCY } = require('../utils/amounts');
const { minutesToHours } = require('../utils/hours');

// Invoices: a preview of what an invoice would contain, creating one, the list, the stored PDF and deleting one.
// The rules are in utils/invoicing.js, the storage and the numbering in models/Invoice.js.


const lineJson = (line) => ({
  projectId: line.projectId,
  name: line.name,
  minutes: line.minutes,
  hours: minutesToHours(line.minutes),
  hourlyRate: decimal(line.rateCents),
  amount: decimal(line.cents),
});

// An invoice of the database as the API shows it (amounts as strings with two decimals, like the JSON report)
const summaryJson = (row) => ({
  id: row.id,
  number: row.number,
  customerId: row.customer_id,
  customerName: row.customer_name,
  invoiceDate: row.invoice_date,
  periodFrom: row.period_from,
  periodTo: row.period_to,
  language: row.language,
  vatMode: row.vat_mode,
  vatRate: row.vat_rate,
  currency: CURRENCY,
  net: decimal(row.net_cents),
  vat: decimal(row.vat_cents),
  gross: decimal(row.gross_cents),
  createdAt: row.created_at,
});

// Everything a preview and a new invoice share: the request, the customer, the settings and the lines. Answers 400 or 404
// itself and returns null then.
async function prepare(req, res) {
  const parsed = parseInvoiceRequest(req.body);
  if (parsed.error) {
    res.status(400).json({ error: parsed.error });
    return null;
  }
  const { customerId, range, invoiceDate, lang, groupByTask: grouped, timeZone } = parsed.value;
  const customerRow = await Customer.getById(customerId);
  if (!customerRow) {
    res.status(404).json({ error: 'Customer not found' });
    return null;
  }
  const [stored, settings] = await Promise.all([TimeEntry.getByCustomerIdInRange(customerId, range), Settings.get()]);
  // The same hours as a report of the period: the customer's own rounding rule, else the global one
  // With grouped, the entries of one day and task are rounded as one (utils/tasks.js), like the grouped report
  const entries = withBilledHours(grouped ? groupByTask(stored, timeZone) : stored, roundingRuleOf(settings));
  const built = buildInvoice(entries, { vatMode: settings.vatMode, vatRate: settings.vatRate });
  const sender = senderOf(settings);
  const customer = { name: customerRow.name, address: customerRow.address, taxId: customerRow.tax_id };
  return {
    ...parsed.value,
    invoiceDate,
    customerRow,
    customer,
    sender,
    settings,
    built,
    missing: missingDetails({ sender, customer, lineCount: built.lines.length }),
    // The customer's own report language, else the one of the request (the app's language), else the default
    language: customerRow.report_language ?? lang ?? DEFAULT_LOCALE,
  };
}

// What an invoice for the customer and period would contain, without taking a number or storing anything. `missing` lists
// what is still needed (codes: senderName, senderAddress, senderTaxId, customerAddress, noEntries); `number` is the number it
// would get now, which is not reserved.
exports.preview = async (req, res) => {
  try {
    const data = await prepare(req, res);
    if (!data) return;
    const { built, settings, invoiceDate } = data;
    const date = new Date(`${invoiceDate}T00:00:00Z`);
    const counter = await InvoiceCounter.next(counterScope(settings.invoiceNumberPattern, date));
    res.json({
      customer: { id: data.customerRow.id, name: data.customer.name },
      from: data.from,
      to: data.to,
      invoiceDate,
      language: data.language,
      number: formatInvoiceNumber(settings.invoiceNumberPattern, counter, date),
      lines: built.lines.map(lineJson),
      currency: CURRENCY,
      vatMode: settings.vatMode,
      vatRate: settings.vatRate,
      net: decimal(built.netCents),
      vat: decimal(built.vatCents),
      gross: decimal(built.grossCents),
      missing: data.missing,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to prepare the invoice' });
  }
};

// What is stored of an invoice, from what prepare() found: a copy of your details, the customer's and the lines (no logo: it is in the PDF only)
const storedInvoice = (data) => ({
  customerId: data.customerRow.id,
  pattern: data.settings.invoiceNumberPattern,
  invoiceDate: data.invoiceDate,
  periodFrom: data.from,
  periodTo: data.to,
  language: data.language,
  customer: data.customer,
  sender: data.sender,
  vatMode: data.settings.vatMode,
  vatRate: data.settings.vatRate,
  lines: data.built.lines,
  netCents: data.built.netCents,
  vatCents: data.built.vatCents,
  grossCents: data.built.grossCents,
});

// Creates the invoice: takes the next number, makes the PDF and stores both (a copy of everything, so later changes do not
// touch it). 422 with `missing` when something is still needed, 409 when the number is already used.
exports.create = async (req, res) => {
  try {
    const data = await prepare(req, res);
    if (!data) return;
    if (data.missing.length > 0) {
      return res.status(422).json({ error: 'Details for the invoice are missing', missing: data.missing });
    }
    const invoice = storedInvoice(data);
    const logo = await Logo.get();
    const row = await Invoice.create(invoice, (number) => generateInvoicePDF(
      { ...invoice, number, sender: { ...invoice.sender, logo: logo?.data ?? null } },
      { locale: data.language }
    ));
    res.status(201).json(summaryJson(row));
  } catch (err) {
    // The customer was deleted after it was read
    if (err.code === '23503') return res.status(404).json({ error: 'Customer not found' });
    if (err.code === 'NUMBER_TAKEN') {
      return res.status(409).json({ error: `${err.message}. Raise the next invoice number in the settings.`, code: err.code });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create the invoice' });
  }
};

exports.getAll = async (req, res) => {
  try {
    res.json((await Invoice.getAll()).map(summaryJson));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};

// The PDF that was made when the invoice was created, unchanged; inline=1 opens it in the browser
exports.getPdf = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Invoice not found' });
    const invoice = await Invoice.getPdf(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', contentDisposition(invoiceFileName(invoice.number), { type: req.query.inline === '1' ? 'inline' : 'attachment' }));
    res.send(invoice.pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch the invoice' });
  }
};

// Deletes an invoice with its PDF and lines. Its number stays used: the counter does not move back.
exports.delete = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Invoice not found' });
    if (!(await Invoice.delete(req.params.id))) return res.status(404).json({ error: 'Invoice not found' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete the invoice' });
  }
};
