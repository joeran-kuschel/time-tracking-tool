// A fake pdfkit document on A4 that records every text() call with its page and position.
// A text is 10 points high per line, with one line per 5 points of width per character.
jest.mock('pdfkit', () => {
  const { EventEmitter } = require('events');
  return class FakeDocument extends EventEmitter {
    constructor() {
      super();
      this.y = 100;
      this.page = { height: 842, margins: { top: 50, bottom: 50 } };
      this.pageNumber = 1;
      FakeDocument.last = this;
      this.texts = [];
      this.calls = [];
      this.registered = {};
      this.fontsUsed = new Set();
    }
    registerFont(name, file) { this.registered[name] = file; return this; }
    fontSize() { return this; }
    font(name) { this.fontsUsed.add(name); return this; }
    text(value, x, y) {
      this.texts.push(String(value));
      this.calls.push({ value: String(value), y, page: this.pageNumber });
      return this;
    }
    heightOfString(value, { width }) { return Math.max(1, Math.ceil((String(value).length * 5) / width)) * 10; }
    moveDown() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    stroke() { return this; }
    addPage() { this.pageNumber += 1; return this; }
    end() { this.emit('data', Buffer.from('pdf')); this.emit('end'); }
  };
});

const PDFDocument = require('pdfkit');
const { generateReportPDF, reportFileName } = require('../src/utils/pdfGenerator');

const entries = [
  { start_time: '2026-03-02T08:00:00Z', end_time: '2026-03-02T09:30:00Z', project_name: 'Website', description: 'Konzept' },
  { start_time: '2026-03-03T08:00:00Z', end_time: '2026-03-03T10:15:00Z', project_name: 'Website', description: null },
];

async function texts(locale) {
  await generateReportPDF(entries, { customerName: 'Muster GmbH', month: 3, year: 2026, locale });
  return PDFDocument.last.texts;
}

describe('generateReportPDF', () => {
  test('writes the report in English', async () => {
    const written = await texts('en');
    expect(written).toEqual(expect.arrayContaining([
      'TIME REPORT', 'March 2026', 'Customer: Muster GmbH', 'Date', 'Project', 'Hours', 'Description',
      '3/2/2026', '1.50 h', '2.25 h', 'TOTAL HOURS:', '3.75 h',
    ]));
  });

  test('writes the report in German', async () => {
    const written = await texts('de');
    expect(written).toEqual(expect.arrayContaining([
      'ZEITABRECHNUNG', 'März 2026', 'Kunde: Muster GmbH', 'Datum', 'Projekt', 'Stunden', 'Beschreibung',
      '2.3.2026', '1,50 h', '2,25 h', 'GESAMTSTUNDEN:', '3,75 h',
    ]));
  });

  test('stays German without a language, like before', async () => {
    expect(await texts(undefined)).toContain('ZEITABRECHNUNG');
  });

  test('dates the entries in the given time zone', async () => {
    const lateEntry = { start_time: '2026-02-28T23:30:00Z', end_time: '2026-03-01T00:30:00Z', project_name: 'Website' };

    await generateReportPDF([lateEntry], { customerName: 'Muster GmbH', month: 3, year: 2026, locale: 'de', timeZone: 'Europe/Berlin' });

    expect(PDFDocument.last.texts).toContain('1.3.2026');
  });
});

describe('generateReportPDF fonts', () => {
  test('writes everything in IBM Plex Sans, regular and semibold, never in Helvetica', async () => {
    await texts('de');
    const doc = PDFDocument.last;

    expect(Object.keys(doc.registered)).toEqual(['Plex', 'Plex-SemiBold']);
    expect(doc.registered.Plex).toMatch(/assets\/fonts\/IBMPlexSans-Regular\.woff$/);
    expect(doc.registered['Plex-SemiBold']).toMatch(/assets\/fonts\/IBMPlexSans-SemiBold\.woff$/);
    expect([...doc.fontsUsed].sort()).toEqual(['Plex', 'Plex-SemiBold']);
  });

  test('ships the font files and their license', () => {
    const fs = jest.requireActual('fs');
    const dir = require('path').join(__dirname, '..', 'assets', 'fonts');
    expect(fs.readdirSync(dir).sort()).toEqual(['IBMPlexSans-Regular.woff', 'IBMPlexSans-SemiBold.woff', 'OFL.txt']);
  });
});

describe('generateReportPDF layout', () => {
  const entry = (day, description) => ({
    start_time: `2026-03-${String(day).padStart(2, '0')}T08:00:00Z`, end_time: `2026-03-${String(day).padStart(2, '0')}T09:00:00Z`,
    project_name: 'Website', description,
  });
  const at = (value) => PDFDocument.last.calls.filter((call) => call.value === value);

  test('makes a row with a long description as tall as its wrapped text', async () => {
    await generateReportPDF([entry(2, 'x'.repeat(200)), entry(3, 'kurz')], { customerName: 'Muster', month: 3, year: 2026, locale: 'de' });

    // 200 characters in the 235 points wide column: 5 lines of 10 points, plus the gap between rows
    const [first] = at('2.3.2026');
    const [second] = at('3.3.2026');
    expect(second.y - first.y).toBe(50 + 6);
  });

  test('starts a new page with the column titles when a row does not fit', async () => {
    const entries = Array.from({ length: 40 }, (_, i) => entry((i % 28) + 1, 'x'.repeat(100)));

    await generateReportPDF(entries, { customerName: 'Muster', month: 3, year: 2026, locale: 'de' });

    const pages = new Set(PDFDocument.last.calls.map((call) => call.page));
    expect(pages.size).toBeGreaterThan(1);
    expect(at('Beschreibung').map((call) => call.page)).toEqual([...pages]);
    expect(PDFDocument.last.calls.every((call) => call.y === undefined || call.y <= 842 - 50)).toBe(true);
  });
});

describe('reportFileName', () => {
  test('names the file in the given language', () => {
    expect(reportFileName('Muster', 3, 2026, 'en')).toBe('time-report-Muster-2026-3.pdf');
    expect(reportFileName('Muster', 3, 2026, 'de')).toBe('abrechnung-Muster-2026-3.pdf');
  });
});
