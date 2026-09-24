const path = require('path');
const PDFDocument = require('pdfkit');
const { i18n } = require('@lingui/core');
const { activateLocale } = require('../i18n');

function calculateHours(startTime, endTime) {
  if (!endTime) return 0;
  const diff = new Date(endTime) - new Date(startTime);
  return (diff / (1000 * 60 * 60)).toFixed(2);
}

function formatHours(hours) {
  return `${i18n.number(Number(hours), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`;
}

function reportFileName(customerName, month, year, locale) {
  activateLocale(locale);
  return `${i18n._({ id: 'report.filename', message: 'time-report' })}-${customerName}-${year}-${month}.pdf`;
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
const ROW_GAP = 6;
const TOTAL_HEIGHT = 30;

const pageBottom = (doc) => doc.page.height - doc.page.margins.bottom;

function line(doc, y) {
  doc.moveTo(TABLE_LEFT, y).lineTo(TABLE_RIGHT, y).stroke();
}

// The height of a row in the current font: its tallest cell
function rowHeight(doc, cells) {
  return Math.max(...COLUMNS.map((column) => doc.heightOfString(cells[column.key], { width: column.width })));
}

function drawCells(doc, cells, y) {
  for (const column of COLUMNS) {
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
function drawTableHeader(doc, y) {
  const titles = {
    date: i18n._({ id: 'report.date', message: 'Date' }),
    project: i18n._({ id: 'report.project', message: 'Project' }),
    hours: i18n._({ id: 'report.hours', message: 'Hours' }),
    description: i18n._({ id: 'report.description', message: 'Description' }),
  };
  doc.fontSize(10).font(FONTS.bold.name);
  drawCells(doc, titles, y);
  const lineY = y + rowHeight(doc, titles) + 3;
  line(doc, lineY);
  doc.fontSize(9).font(FONTS.regular.name);
  return lineY + ROW_GAP;
}

// One row; a row that doesn't fit starts a new page with the column titles. Returns the y below the row.
function drawRow(doc, cells, y) {
  const height = rowHeight(doc, cells);
  let top = y;
  if (top + height > pageBottom(doc)) {
    doc.addPage();
    top = drawTableHeader(doc, doc.page.margins.top);
  }
  drawCells(doc, cells, top);
  return top + height + ROW_GAP;
}

function drawTotal(doc, totalHours, y) {
  let top = y;
  if (top + TOTAL_HEIGHT > pageBottom(doc)) {
    doc.addPage();
    top = doc.page.margins.top;
  }
  line(doc, top);
  doc.fontSize(10).font(FONTS.bold.name);
  const hours = COLUMNS.find((column) => column.key === 'hours');
  doc.text(i18n._({ id: 'report.total', message: 'TOTAL HOURS:' }), TABLE_LEFT, top + 8, { width: hours.x - TABLE_LEFT });
  doc.text(formatHours(totalHours), hours.x, top + 8, { width: hours.width, align: 'right' });
}

function entryCells(entry, timeZone) {
  return {
    date: i18n.date(entry.start_time, { year: 'numeric', month: 'numeric', day: 'numeric', timeZone }),
    project: entry.project_name,
    hours: formatHours(calculateHours(entry.start_time, entry.end_time)),
    description: entry.description || '',
  };
}

// All texts are translated synchronously after activateLocale, see src/i18n.js.
// timeZone: the browser's, so dates show as on the Reports page.
function generateReportPDF(entries, { customerName, month, year, locale, timeZone = 'UTC' }) {
  return new Promise((resolve, reject) => {
    try {
      activateLocale(locale);
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      registerFonts(doc);
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      drawTitle(doc, { customerName, month, year });
      let y = drawTableHeader(doc, doc.y);
      for (const entry of entries) {
        y = drawRow(doc, entryCells(entry, timeZone), y);
      }
      const totalHours = entries.reduce((sum, entry) => sum + Number(calculateHours(entry.start_time, entry.end_time)), 0);
      drawTotal(doc, totalHours, y);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  calculateHours,
  generateReportPDF,
  reportFileName
};
