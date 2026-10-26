const path = require('path');
const PDFDocument = require('pdfkit');
const { i18n } = require('@lingui/core');
const { activateLocale } = require('../i18n');

const { calculateHours } = require('./hours');
const { formatDecimal } = require('./reportRows');
const { reportAmounts, formatMoney } = require('./amounts');

const formatHours = (hours) => `${formatDecimal(hours)} h`;

function reportFileName(customerName, month, year, locale, extension = 'pdf') {
  activateLocale(locale);
  return `${i18n._({ id: 'report.filename', message: 'time-report' })}-${customerName}-${year}-${month}.${extension}`;
}

// IBM Plex Sans, the app's font (assets/fonts, from @ibm/plex-sans 1.1.0, SIL Open Font License). Unlike pdfkit's
// built-in Helvetica it covers Central European letters like "Ł" and "ź", Greek and Cyrillic. pdfkit embeds only the
// letters a report uses.
const FONT_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');
const FONTS = {
  regular: { name: 'Plex', file: path.join(FONT_DIR, 'IBMPlexSans-Regular.woff') },
  bold: { name: 'Plex-SemiBold', file: path.join(FONT_DIR, 'IBMPlexSans-SemiBold.woff') },
};

function registerFonts(doc) {
  for (const font of Object.values(FONTS)) doc.registerFont(font.name, font.file);
}

// Table layout in points on A4 (595 wide, margins 50). Rows are as tall as their tallest cell,
// so long project names and descriptions wrap inside their column.
const TABLE_LEFT = 50;
const TABLE_RIGHT = 545;
const COLUMNS = [
  { key: 'date', x: 50, width: 65 },
  { key: 'project', x: 120, width: 120 },
  { key: 'hours', x: 245, width: 55, align: 'right' },
  { key: 'description', x: 310, width: 235 },
];
// With amounts there is an amount column instead of the rate (the rates are in the per project block)
const COLUMNS_WITH_AMOUNTS = [
  { key: 'date', x: 50, width: 55 },
  { key: 'project', x: 110, width: 90 },
  { key: 'hours', x: 205, width: 50, align: 'right' },
  { key: 'amount', x: 260, width: 65, align: 'right' },
  { key: 'description', x: 335, width: 210 },
];
const PROJECT_COLUMNS = [
  { key: 'project', x: 50, width: 150 },
  { key: 'hours', x: 205, width: 50, align: 'right' },
  { key: 'rate', x: 260, width: 65, align: 'right' },
  { key: 'amount', x: 335, width: 75, align: 'right' },
];
const columnsFor = (showAmounts) => (showAmounts ? COLUMNS_WITH_AMOUNTS : COLUMNS);
const ROW_GAP = 6;
const TOTAL_HEIGHT = 30;
const TOTAL_HEIGHT_WITH_AMOUNT = 46;
// The heading of the per project block, its column titles and a first row stay together
const PROJECTS_MIN_HEIGHT = 70;

const pageBottom = (doc) => doc.page.height - doc.page.margins.bottom;

function line(doc, y) {
  doc.moveTo(TABLE_LEFT, y).lineTo(TABLE_RIGHT, y).stroke();
}

// The height of a row in the current font: its tallest cell
function rowHeight(doc, cells, columns) {
  return Math.max(...columns.map((column) => doc.heightOfString(cells[column.key], { width: column.width })));
}

function drawCells(doc, cells, y, columns) {
  for (const column of columns) {
    doc.text(cells[column.key], column.x, y, { width: column.width, align: column.align ?? 'left' });
  }
}

function drawTitle(doc, { customerName, month, year }) {
  doc.fontSize(20).font(FONTS.bold.name);
  doc.text(i18n._({ id: 'report.title', message: 'TIME REPORT' }), { align: 'center' });

  doc.fontSize(12).font(FONTS.regular.name);
  const monthName = i18n.date(new Date(Date.UTC(year, month - 1, 1)), { month: 'long', year: 'numeric', timeZone: 'UTC' });
  doc.text(monthName, { align: 'center' });
  doc.text(i18n._({ id: 'report.customer', message: 'Customer: {customerName}' }, { customerName }), { align: 'center' });
  doc.moveDown(1);
}

// The column titles with a line below; leaves the font set for rows and returns the y of the first row
function drawTableHeader(doc, y, columns) {
  const titles = {
    date: i18n._({ id: 'report.date', message: 'Date' }),
    project: i18n._({ id: 'report.project', message: 'Project' }),
    hours: i18n._({ id: 'report.hours', message: 'Hours' }),
    description: i18n._({ id: 'report.description', message: 'Description' }),
    amount: i18n._({ id: 'report.amount', message: 'Amount' }),
    rate: i18n._({ id: 'report.rate', message: 'Rate' }),
  };
  doc.fontSize(10).font(FONTS.bold.name);
  drawCells(doc, titles, y, columns);
  const lineY = y + rowHeight(doc, titles, columns) + 3;
  line(doc, lineY);
  doc.fontSize(9).font(FONTS.regular.name);
  return lineY + ROW_GAP;
}

// One row; a row that doesn't fit starts a new page with the column titles. Returns the y below the row.
function drawRow(doc, cells, y, columns) {
  const height = rowHeight(doc, cells, columns);
  let top = y;
  if (top + height > pageBottom(doc)) {
    doc.addPage();
    top = drawTableHeader(doc, doc.page.margins.top, columns);
  }
  drawCells(doc, cells, top, columns);
  return top + height + ROW_GAP;
}

// The total hours and, with amounts, the total amount below; the numbers end at the same edge
function drawTotal(doc, { hours, cents }, y, showAmounts) {
  const height = showAmounts ? TOTAL_HEIGHT_WITH_AMOUNT : TOTAL_HEIGHT;
  let top = y;
  if (top + height > pageBottom(doc)) {
    doc.addPage();
    top = doc.page.margins.top;
  }
  line(doc, top);
  doc.fontSize(10).font(FONTS.bold.name);
  const column = columnsFor(showAmounts).find((c) => c.key === 'hours');
  const amountColumn = COLUMNS_WITH_AMOUNTS.find((c) => c.key === 'amount');
  // With amounts the values share the right edge of the amount column
  const valueWidth = showAmounts ? amountColumn.x + amountColumn.width - column.x : column.width;
  doc.text(i18n._({ id: 'report.total', message: 'TOTAL HOURS:' }), TABLE_LEFT, top + 8, { width: column.x - TABLE_LEFT });
  doc.text(formatHours(hours), column.x, top + 8, { width: valueWidth, align: 'right' });
  if (showAmounts) {
    doc.text(i18n._({ id: 'report.totalAmount', message: 'TOTAL AMOUNT:' }), TABLE_LEFT, top + 24, { width: column.x - TABLE_LEFT });
    doc.text(formatMoney(cents), column.x, top + 24, { width: valueWidth, align: 'right' });
  }
}

// The block after the table: hours, rate and amount per project, in the order the projects first appear
function drawProjects(doc, projects, y) {
  let top = y + 2 * ROW_GAP;
  if (top + PROJECTS_MIN_HEIGHT > pageBottom(doc)) {
    doc.addPage();
    top = doc.page.margins.top;
  }
  doc.fontSize(11).font(FONTS.bold.name);
  doc.text(i18n._({ id: 'report.projects', message: 'Per project' }), TABLE_LEFT, top);
  top = drawTableHeader(doc, top + 18, PROJECT_COLUMNS);
  for (const project of projects) {
    top = drawRow(doc, {
      project: project.name,
      hours: formatHours(project.hundredths / 100),
      rate: `${formatMoney(project.rateCents)}/h`,
      amount: formatMoney(project.cents),
    }, top, PROJECT_COLUMNS);
  }
  return top;
}

function entryCells(entry, timeZone, cents) {
  return {
    ...(cents === undefined ? {} : { amount: formatMoney(cents) }),
    date: i18n.date(entry.start_time, { year: 'numeric', month: 'numeric', day: 'numeric', timeZone }),
    project: entry.project_name,
    hours: formatHours(calculateHours(entry.start_time, entry.end_time)),
    description: entry.description || '',
  };
}

// All texts are translated synchronously after activateLocale, see src/i18n.js.
// timeZone: the browser's, so dates show as on the Reports page.
function generateReportPDF(entries, { customerName, month, year, locale, timeZone = 'UTC', amounts = false }) {
  return new Promise((resolve, reject) => {
    try {
      activateLocale(locale);
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      registerFonts(doc);
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      drawTitle(doc, { customerName, month, year });
      const columns = columnsFor(amounts);
      const money = amounts ? reportAmounts(entries) : null;
      let y = drawTableHeader(doc, doc.y, columns);
      entries.forEach((entry, index) => {
        y = drawRow(doc, entryCells(entry, timeZone, money?.entryCents[index]), y, columns);
      });
      if (money) y = drawProjects(doc, money.projects, y);
      const totalHours = entries.reduce((sum, entry) => sum + Number(calculateHours(entry.start_time, entry.end_time)), 0);
      drawTotal(doc, { hours: totalHours, cents: money?.totalCents }, y, amounts);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateReportPDF,
  reportFileName
};
