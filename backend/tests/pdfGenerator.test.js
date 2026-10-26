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

describe('generateReportPDF with amounts', () => {
  const priced = [
    { project_id: 1, hourly_rate: '80.00', start_time: '2026-03-02T08:00:00Z', end_time: '2026-03-02T09:30:00Z', project_name: 'Website', description: 'Konzept' },
    { project_id: 2, hourly_rate: '0.00', start_time: '2026-03-03T08:00:00Z', end_time: '2026-03-03T09:00:00Z', project_name: 'Gratis', description: null },
    { project_id: 3, hourly_rate: '33.33', start_time: '2026-03-04T08:00:00Z', end_time: '2026-03-04T08:20:00Z', project_name: 'App', description: null },
    { project_id: 1, hourly_rate: '80.00', start_time: '2026-03-05T08:00:00Z', end_time: '2026-03-05T09:00:00Z', project_name: 'Website', description: null },
    { project_id: 1, hourly_rate: '80.00', start_time: '2026-03-06T08:00:00Z', end_time: null, project_name: 'Website', description: null },
  ];
  const options = { customerName: 'Muster GmbH', month: 3, year: 2026 };
  const nbsp = (list) => list.map((value) => value.replace(/\s/g, ' '));
  const run = async (overrides, list = priced) => {
    await generateReportPDF(list, { ...options, ...overrides });
    return nbsp(PDFDocument.last.texts);
  };

  test('writes the amount per row, the block per project and the total amount in English', async () => {
    const written = await run({ locale: 'en', amounts: true });

    expect(written).toEqual(expect.arrayContaining(['Amount', '€120.00', '€0.00', '€11.00', '€80.00', 'Per project', 'Rate', '€80.00/h', '€33.33/h', 'TOTAL AMOUNT:', '€211.00']));
    // 1.50 + 1.00 + 0.33 + 1.00 + 0 = 3.83 hours
    expect(written).toEqual(expect.arrayContaining(['TOTAL HOURS:', '3.83 h']));
  });

  test('writes them in German', async () => {
    const written = await run({ locale: 'de', amounts: true });

    expect(written).toEqual(expect.arrayContaining(['Betrag', 'Je Projekt', 'Stundensatz', '80,00 €/h', '0,00 €/h', '33,33 €/h', 'GESAMTBETRAG:', '211,00 €', '2,50 h']));
  });

  test('lists a project once, in the order of its first entry, with the sum of its rounded hours and amounts', async () => {
    await run({ locale: 'de', amounts: true });
    const block = PDFDocument.last.calls.filter((call) => call.y > PDFDocument.last.calls.find((c) => c.value === 'Je Projekt').y);
    const names = block.map((call) => call.value).filter((value) => ['Website', 'Gratis', 'App'].includes(value));

    expect(names).toEqual(['Website', 'Gratis', 'App']);
  });

  test('shows a running entry and a project with rate 0 as 0,00 €', async () => {
    const written = await run({ locale: 'de', amounts: true });

    expect(written.filter((value) => value === '0,00 €').length).toBeGreaterThanOrEqual(3);
  });

  test('puts the total amount line below the total hours line', async () => {
    await run({ locale: 'de', amounts: true });
    const [hours] = PDFDocument.last.calls.filter((call) => call.value === 'GESAMTSTUNDEN:');
    const [amount] = PDFDocument.last.calls.filter((call) => call.value === 'GESAMTBETRAG:');

    expect(amount.y).toBeGreaterThan(hours.y);
  });

  test('makes no new calls without the flag, or with it off', async () => {
    const before = await run({ locale: 'de' });
    const plain = PDFDocument.last.calls.map(({ value, y, page }) => [value, y, page]);
    const off = await run({ locale: 'de', amounts: false });

    expect(PDFDocument.last.calls.map(({ value, y, page }) => [value, y, page])).toEqual(plain);
    expect(off).toEqual(before);
    for (const word of ['Betrag', 'Stundensatz', 'Je Projekt', 'GESAMTBETRAG:', '211,00 €']) expect(before).not.toContain(word);
    expect(before.filter((value) => /€/.test(value))).toEqual([]);
  });

  test('repeats the column titles of both tables on a new page, and keeps every text inside the page', async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ ...priced[0], start_time: `2026-03-${String((i % 28) + 1).padStart(2, '0')}T08:00:00Z`, end_time: `2026-03-${String((i % 28) + 1).padStart(2, '0')}T09:00:00Z`, project_id: i % 20, project_name: `Projekt ${i % 20}`, description: 'x'.repeat(100) }));

    await run({ locale: 'de', amounts: true }, many);

    const doc = PDFDocument.last;
    const pages = new Set(doc.calls.map((call) => call.page));
    expect(pages.size).toBeGreaterThan(2);
    expect(doc.calls.filter((call) => call.value === 'Betrag').map((call) => call.page).length).toBeGreaterThanOrEqual(pages.size);
    expect(doc.calls.every((call) => call.y === undefined || call.y <= 842 - 50)).toBe(true);
    expect(nbsp(doc.texts)).toContain('GESAMTBETRAG:');
  });
});

describe('generateReportPDF with amounts: page breaks', () => {
  const rowsOf = (count, overrides = {}) => Array.from({ length: count }, (_, i) => ({
    project_id: i % 4,
    project_name: `Projekt ${i % 4}`,
    hourly_rate: '80.00',
    start_time: '2026-03-02T08:00:00Z',
    end_time: '2026-03-02T09:00:00Z',
    description: 'Beschreibung',
    ...overrides,
  }));
  const generate = async (list) => {
    await generateReportPDF(list, { customerName: 'Muster', month: 3, year: 2026, locale: 'de', amounts: true });
    return PDFDocument.last.calls;
  };
  const first = (calls, value) => calls.find((call) => call.value === value);

  test('never leaves the heading of the project block alone at the bottom of a page, for any number of rows', async () => {
    for (let count = 1; count <= 70; count += 1) {
      const calls = await generate(rowsOf(count));
      const heading = first(calls, 'Je Projekt');
      const firstProject = calls.slice(calls.indexOf(heading)).find((call) => /^Projekt \d$/.test(call.value));

      expect(firstProject.page).toBe(heading.page);
    }
  });

  test('keeps the total hours and the total amount on the same page and inside it, for any number of rows', async () => {
    for (let count = 1; count <= 70; count += 1) {
      const calls = await generate(rowsOf(count));

      expect(first(calls, 'GESAMTBETRAG:').page).toBe(first(calls, 'GESAMTSTUNDEN:').page);
      expect(calls.every((call) => call.y === undefined || call.y <= 792)).toBe(true);
    }
  });

  test('puts the total amount on the page of the last text, not on an empty page', async () => {
    for (let count = 1; count <= 70; count += 1) {
      const calls = await generate(rowsOf(count));
      const pagesWithTexts = new Set(calls.map((call) => call.page));

      expect(PDFDocument.last.pageNumber).toBe(pagesWithTexts.size);
    }
  });

  test('wraps a long project name in the project block without overlapping the next row', async () => {
    const calls = await generate([...rowsOf(1, { project_name: 'Ein sehr langer Projektname '.repeat(6) }), ...rowsOf(1, { project_id: 9, project_name: 'Kurz' })]);
    const [longName, short] = [calls.filter((c) => c.value.startsWith('Ein sehr'))[1], calls.filter((c) => c.value === 'Kurz')[1]];

    // 162 characters in a 150 wide column: five lines of 10 points
    expect(short.y - longName.y).toBeGreaterThanOrEqual(50);
  });

  test('lists a thousand projects without losing one', async () => {
    const calls = await generate(rowsOf(1000, { project_id: undefined }).map((e, i) => ({ ...e, project_id: i, project_name: `P${i}` })));

    expect(calls.filter((call) => /^P\d+$/.test(call.value)).length).toBe(2000);
  });
});

describe('generateReportPDF with an entry that ends before it starts', () => {
  const backwards = { project_id: 1, hourly_rate: '80.00', start_time: '2026-03-02T09:00:00Z', end_time: '2026-03-02T08:00:00Z', project_name: 'Website', description: null };
  const normal = { project_id: 1, hourly_rate: '80.00', start_time: '2026-03-03T08:00:00Z', end_time: '2026-03-03T09:30:00Z', project_name: 'Website', description: null };
  const run = async (overrides) => {
    await generateReportPDF([backwards, normal], { customerName: 'Muster', month: 3, year: 2026, locale: 'en', ...overrides });
    return PDFDocument.last.texts.map((value) => value.replace(/\s/g, ' '));
  };

  test('without amounts it still prints the negative hours and the total as before', async () => {
    const written = await run({});

    expect(written).toEqual(expect.arrayContaining(['-1.00 h', '1.50 h', 'TOTAL HOURS:', '0.50 h']));
  });

  test('with amounts the row keeps its hours, the project and the totals count it as 0', async () => {
    const written = await run({ amounts: true });

    expect(written).toEqual(expect.arrayContaining(['-1.00 h', '€0.00', '€120.00', '€80.00/h', 'TOTAL AMOUNT:']));
    // The project block and the total amount: 1.50 h and 120.00, never below zero
    expect(written.filter((value) => value === '€120.00')).toHaveLength(3);
    expect(written.filter((value) => /^-€|^€-/.test(value))).toEqual([]);
  });
});
