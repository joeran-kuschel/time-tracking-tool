// A fake pdfkit document that records every text() call
jest.mock('pdfkit', () => {
  const { EventEmitter } = require('events');
  return class FakeDocument extends EventEmitter {
    constructor() {
      super();
      this.y = 100;
      FakeDocument.last = this;
      this.texts = [];
    }
    fontSize() { return this; }
    font() { return this; }
    text(value) { this.texts.push(String(value)); return this; }
    moveDown() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    stroke() { return this; }
    addPage() { return this; }
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
  await generateReportPDF(entries, 'Muster GmbH', 3, 2026, locale);
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
});

describe('reportFileName', () => {
  test('names the file in the given language', () => {
    expect(reportFileName('Muster', 3, 2026, 'en')).toBe('time-report-Muster-2026-3.pdf');
    expect(reportFileName('Muster', 3, 2026, 'de')).toBe('abrechnung-Muster-2026-3.pdf');
  });
});
