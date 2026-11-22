const PDFDocument = require('pdfkit');
const { i18n } = require('@lingui/core');
const { activateLocale } = require('../i18n');
const { formatDuration } = require('./hours');
const { formatMoney } = require('./amounts');
const { FONTS, registerFonts, drawSender, drawCells, rowHeight, line, pageBottom, TABLE_LEFT, TABLE_RIGHT } = require('./pdfGenerator');

// The invoice as a PDF on A4, built with the report's fonts and sender block (utils/pdfGenerator.js). All texts are
// translated synchronously after activateLocale, see src/i18n.js.

// Table layout in points: the description is as wide as it can be, the numbers end at the right edge
const COLUMNS = [
  { key: 'description', x: 50, width: 255 },
  { key: 'hours', x: 310, width: 60, align: 'right' },
  { key: 'rate', x: 375, width: 80, align: 'right' },
  { key: 'amount', x: 460, width: 85, align: 'right' },
];
const AMOUNT = COLUMNS.find((column) => column.key === 'amount');
const LABEL_X = 310;
const ROW_GAP = 6;
const LINE_HEIGHT = 16;
// The totals and the notes after them stay together
const TOTALS_HEIGHT = 3 * LINE_HEIGHT + 40;

// 05.03.2026 in German, 03/05/2026 in English; the days are calendar days, so UTC
const formatDay = (day) => i18n.date(new Date(`${day}T00:00:00Z`), { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

// The customer's name in bold, then its address and tax ID, at the left
function drawRecipient(doc, customer) {
  const lines = [customer.address, customer.taxId && i18n._({ id: 'invoice.customerTaxId', message: 'Tax ID: {taxId}' }, { taxId: customer.taxId })]
    .filter(Boolean).flatMap((value) => value.split('\n')).filter((value) => value.trim() !== '');
  doc.fontSize(11).font(FONTS.bold.name).text(customer.name, TABLE_LEFT, doc.y, { width: 300 });
  doc.fontSize(10).font(FONTS.regular.name);
  for (const value of lines) doc.text(value, TABLE_LEFT, undefined, { width: 300 });
  doc.moveDown(2);
}

// The title, then the number, the date and the period the invoice covers
function drawHeading(doc, { number, invoiceDate, periodFrom, periodTo }) {
  doc.fontSize(20).font(FONTS.bold.name).text(i18n._({ id: 'invoice.title', message: 'INVOICE' }), TABLE_LEFT, doc.y);
  doc.moveDown(0.5);
  doc.fontSize(10).font(FONTS.regular.name);
  doc.text(i18n._({ id: 'invoice.number', message: 'Invoice number: {number}' }, { number }));
  doc.text(i18n._({ id: 'invoice.date', message: 'Invoice date: {date}' }, { date: formatDay(invoiceDate) }));
  doc.text(i18n._({ id: 'invoice.period', message: 'Service period: {from} - {to}' }, { from: formatDay(periodFrom), to: formatDay(periodTo) }));
  doc.moveDown(1.5);
}

// The column titles with a line below; leaves the font set for the rows and returns the y of the first row
function drawTableHeader(doc, y) {
  const titles = {
    description: i18n._({ id: 'report.description', message: 'Description' }),
    hours: i18n._({ id: 'report.hours', message: 'Hours' }),
    rate: i18n._({ id: 'report.rate', message: 'Rate' }),
    amount: i18n._({ id: 'report.amount', message: 'Amount' }),
  };
  doc.fontSize(10).font(FONTS.bold.name);
  drawCells(doc, titles, y, COLUMNS);
  const lineY = y + rowHeight(doc, titles, COLUMNS) + 3;
  line(doc, lineY);
  doc.fontSize(10).font(FONTS.regular.name);
  return lineY + ROW_GAP;
}

// One line of the invoice; a row that does not fit starts a new page with the column titles. Returns the y below it.
function drawRow(doc, cells, y) {
  const height = rowHeight(doc, cells, COLUMNS);
  let top = y;
  if (top + height > pageBottom(doc)) {
    doc.addPage();
    top = drawTableHeader(doc, doc.page.margins.top);
  }
  drawCells(doc, cells, top, COLUMNS);
  return top + height + ROW_GAP;
}

// A label at the left of the totals and its amount at the right edge
function drawTotalRow(doc, label, cents, y, bold = false) {
  doc.fontSize(10).font(bold ? FONTS.bold.name : FONTS.regular.name);
  doc.text(label, LABEL_X, y, { width: AMOUNT.x - LABEL_X });
  doc.text(formatMoney(cents), AMOUNT.x, y, { width: AMOUNT.width, align: 'right' });
}

// Net, VAT and the total below the lines; a small business has only the total and the sentence about §19 UStG.
// Returns the y below it.
function drawTotals(doc, { netCents, vatCents, grossCents, vatMode, vatRate }, y) {
  let top = y;
  if (top + TOTALS_HEIGHT > pageBottom(doc)) {
    doc.addPage();
    top = doc.page.margins.top;
  }
  line(doc, top);
  top += 8;
  if (vatMode === 'small_business') {
    drawTotalRow(doc, i18n._({ id: 'invoice.total', message: 'Total amount' }), grossCents, top, true);
    top += LINE_HEIGHT + 8;
    doc.fontSize(9).font(FONTS.regular.name);
    doc.text(i18n._({ id: 'invoice.smallBusiness', message: 'No VAT is charged under section 19 of the German VAT Act (UStG).' }), TABLE_LEFT, top, { width: TABLE_RIGHT - TABLE_LEFT });
    return doc.y + 8;
  }
  drawTotalRow(doc, i18n._({ id: 'invoice.net', message: 'Net amount' }), netCents, top);
  drawTotalRow(doc, i18n._({ id: 'invoice.vat', message: 'VAT {rate} %' }, { rate: vatRate }), vatCents, top + LINE_HEIGHT);
  drawTotalRow(doc, i18n._({ id: 'invoice.total', message: 'Total amount' }), grossCents, top + 2 * LINE_HEIGHT, true);
  return top + 3 * LINE_HEIGHT + 8;
}

// Your bank details at the bottom; nothing when there are none
function drawBankDetails(doc, bankDetails, y) {
  if (!bankDetails) return;
  const lines = bankDetails.split('\n').filter((value) => value.trim() !== '');
  let top = y + LINE_HEIGHT;
  if (top + (lines.length + 1) * LINE_HEIGHT > pageBottom(doc)) {
    doc.addPage();
    top = doc.page.margins.top;
  }
  doc.fontSize(10).font(FONTS.bold.name).text(i18n._({ id: 'invoice.bank', message: 'Bank details' }), TABLE_LEFT, top);
  doc.font(FONTS.regular.name);
  for (const value of lines) doc.text(value, TABLE_LEFT, undefined, { width: TABLE_RIGHT - TABLE_LEFT });
}

// invoice: { number, invoiceDate, periodFrom, periodTo ('YYYY-MM-DD'), customer { name, address, taxId }, sender { name, address,
// email, taxId, bankDetails, logo (an image Buffer) }, vatMode, vatRate, lines [{ name, minutes, rateCents, cents }], netCents,
// vatCents, grossCents }. locale: 'de' or 'en'. Resolves to the PDF as a Buffer.
function generateInvoicePDF(invoice, { locale }) {
  return new Promise((resolve, reject) => {
    try {
      activateLocale(locale);
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      registerFonts(doc);
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      drawSender(doc, invoice.sender);
      drawRecipient(doc, invoice.customer);
      drawHeading(doc, invoice);
      let y = drawTableHeader(doc, doc.y);
      for (const item of invoice.lines) {
        y = drawRow(doc, {
          description: item.name,
          hours: formatDuration(item.minutes),
          rate: `${formatMoney(item.rateCents)}/h`,
          amount: formatMoney(item.cents),
        }, y);
      }
      y = drawTotals(doc, invoice, y);
      drawBankDetails(doc, invoice.sender.bankDetails, y);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoicePDF };
