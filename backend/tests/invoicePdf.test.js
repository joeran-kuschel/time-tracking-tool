// A fake pdfkit document on A4 that records every text() call with its page and position (like pdfGenerator.test.js).
// A text is 10 points high per line, with one line per 5 points of width per character.
jest.mock('pdfkit', () => {
  const { EventEmitter } = require('events');
  return class FakeDocument extends EventEmitter {
    constructor() {
      super();
      this.y = 100;
      this.page = { width: 595, height: 842, margins: { top: 50, bottom: 50, left: 50, right: 50 } };
      this.pageNumber = 1;
      FakeDocument.last = this;
      this.calls = [];
      this.lines = [];
    }
    registerFont() { return this; }
    fontSize() { return this; }
    font(name) { this.currentFont = name; return this; }
    openImage() { return { width: 300, height: 100 }; }
    image() { return this; }
    text(value, x, y, options) {
      this.calls.push({ value: String(value), x, y, options, page: this.pageNumber, font: this.currentFont });
      return this;
    }
    heightOfString(value, { width }) { return Math.max(1, Math.ceil((String(value).length * 5) / width)) * 10; }
    moveDown() { return this; }
    moveTo(x, y) { this.last = y; return this; }
    lineTo() { return this; }
    stroke() { this.lines.push({ y: this.last, page: this.pageNumber }); return this; }
    addPage() { this.pageNumber += 1; return this; }
    end() { this.emit('data', Buffer.from('pdf')); this.emit('end'); }
  };
});

const PDFDocument = require('pdfkit');
const { generateInvoicePDF } = require('../src/utils/invoicePdf');

const invoice = (overrides = {}) => ({
  number: '2026-0007',
  invoiceDate: '2026-03-05',
  periodFrom: '2026-02-01',
  periodTo: '2026-02-28',
  customer: { name: 'Muster GmbH', address: 'Musterweg 1\n12345 Musterstadt', taxId: 'DE999999999' },
  sender: { name: 'Jana Beispiel', address: 'Beispielstr. 5\n54321 Beispielstadt', email: 'jana@example.test', taxId: '12/345/67890', bankDetails: 'DE89 3704 0044 0532 0130 00\nBIC COBADEFFXXX' },
  vatMode: 'regular',
  vatRate: 19,
  lines: [{ name: 'Website', minutes: 750, rateCents: 8000, cents: 100000 }, { name: 'Beratung', minutes: 90, rateCents: 9500, cents: 14250 }],
  netCents: 114250,
  vatCents: 21708,
  grossCents: 135958,
  ...overrides,
});

async function run(options = {}, locale = 'en') {
  const pdf = await generateInvoicePDF(invoice(options), { locale });
  return { pdf, doc: PDFDocument.last, texts: PDFDocument.last.calls.map((call) => call.value) };
}

// The euro sign and the separators differ by language: compare with the digits only
const digits = (text) => text.replace(/[^\d,.]/g, '');

describe('generateInvoicePDF', () => {
  test('resolves to the document bytes', async () => {
    expect((await run()).pdf.toString()).toBe('pdf');
  });

  test('writes the sender block, the recipient, the title, the number, the date and the period, in that order (English)', async () => {
    const { texts } = await run();

    expect(texts.slice(0, 13)).toEqual([
      'Jana Beispiel', 'Beispielstr. 5', '54321 Beispielstadt', 'jana@example.test', 'Tax ID: 12/345/67890',
      'Muster GmbH', 'Musterweg 1', '12345 Musterstadt', 'Tax ID: DE999999999',
      'INVOICE', 'Invoice number: 2026-0007', 'Invoice date: 03/05/2026', 'Service period: 02/01/2026 - 02/28/2026',
    ]);
  });

  test('writes the same in German, with German dates and words', async () => {
    const { texts } = await run({}, 'de');

    expect(texts.slice(0, 13)).toEqual([
      'Jana Beispiel', 'Beispielstr. 5', '54321 Beispielstadt', 'jana@example.test', 'Steuernummer / USt-IdNr.: 12/345/67890',
      'Muster GmbH', 'Musterweg 1', '12345 Musterstadt', 'Steuernummer / USt-IdNr.: DE999999999',
      'RECHNUNG', 'Rechnungsnummer: 2026-0007', 'Rechnungsdatum: 05.03.2026', 'Leistungszeitraum: 01.02.2026 - 28.02.2026',
    ]);
    expect(texts).toEqual(expect.arrayContaining(['Beschreibung', 'Stunden', 'Stundensatz', 'Betrag', 'Nettobetrag', 'Umsatzsteuer 19 %', 'Gesamtbetrag', 'Bankverbindung']));
  });

  test('the recipient is at the left in bold, the sender at the right', async () => {
    const { doc } = await run();
    const call = (value) => doc.calls.find((c) => c.value === value);

    expect(call('Jana Beispiel').options.align).toBe('right');
    expect(call('Muster GmbH').font).toBe('Plex-SemiBold');
    expect(call('Muster GmbH').x).toBe(50);
    expect(call('Musterweg 1').font).toBe('Plex');
  });

  test('a line has its project, its time as h:mm, the rate and the amount; every row on its own', async () => {
    const { texts } = await run();

    expect(texts.slice(texts.indexOf('Amount') + 1, texts.indexOf('Amount') + 9).map((value) => value.replace(/\s/g, ' '))).toEqual([
      'Website', '12:30 h', '€80.00/h', '€1,000.00', 'Beratung', '1:30 h', '€95.00/h', '€142.50',
    ]);
  });

  test('the table has the column titles Description, Hours, Rate and Amount', async () => {
    const { texts } = await run();

    expect(texts.slice(texts.indexOf('Description'), texts.indexOf('Description') + 4)).toEqual(['Description', 'Hours', 'Rate', 'Amount']);
  });

  test('regular VAT: the net amount, the VAT with its rate, and the total in bold', async () => {
    const { doc, texts } = await run();

    const start = texts.indexOf('Net amount');
    expect(texts.slice(start, start + 6).map((value, index) => (index % 2 ? digits(value) : value))).toEqual(['Net amount', '1,142.50', 'VAT 19 %', '217.08', 'Total amount', '1,359.58']);
    expect(doc.calls.find((c) => c.value === 'Total amount').font).toBe('Plex-SemiBold')
    expect(texts).not.toContain('No VAT is charged under section 19 of the German VAT Act (UStG).');
  });

  test('VAT at 7 % and 0 % names its rate', async () => {
    expect((await run({ vatRate: 7 })).texts).toContain('VAT 7 %');
    expect((await run({ vatRate: 0, vatCents: 0, grossCents: 114250 })).texts).toContain('VAT 0 %');
  });

  test('a small business has only the total and the sentence about section 19 UStG, in German too', async () => {
    const english = await run({ vatMode: 'small_business', vatCents: 0, grossCents: 114250 });
    const german = await run({ vatMode: 'small_business', vatCents: 0, grossCents: 114250 }, 'de');

    for (const { texts } of [english, german]) {
      expect(texts.some((value) => /^(Net amount|Nettobetrag)$/.test(value))).toBe(false);
      expect(texts.some((value) => /^(VAT|Umsatzsteuer)/.test(value))).toBe(false);
    }
    expect(english.texts).toEqual(expect.arrayContaining(['Total amount', 'No VAT is charged under section 19 of the German VAT Act (UStG).']));
    expect(german.texts).toEqual(expect.arrayContaining(['Gesamtbetrag', 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.']));
  });

  test('the bank details come last, one line each; without them there is no heading', async () => {
    const withBank = await run();
    const without = await run({ sender: { ...invoice().sender, bankDetails: null } });

    expect(withBank.texts.slice(-3)).toEqual(['Bank details', 'DE89 3704 0044 0532 0130 00', 'BIC COBADEFFXXX']);
    expect(without.texts).not.toContain('Bank details');
    expect(without.texts.at(-1)).toMatch(/1,359\.58/);
  });

  test("a customer without a tax ID has only its name and address, and the sender's optional email can be missing", async () => {
    const { texts } = await run({ customer: { name: 'Muster GmbH', address: 'Weg 1', taxId: null }, sender: { ...invoice().sender, email: null } });

    expect(texts.slice(0, 7)).toEqual(['Jana Beispiel', 'Beispielstr. 5', '54321 Beispielstadt', 'Tax ID: 12/345/67890', 'Muster GmbH', 'Weg 1', 'INVOICE']);
  });

  test('empty lines inside an address are left out', async () => {
    const { texts } = await run({ customer: { name: 'Muster GmbH', address: 'Weg 1\n\n  \nStadt', taxId: null } });

    expect(texts.slice(texts.indexOf('Muster GmbH'), texts.indexOf('Muster GmbH') + 3)).toEqual(['Muster GmbH', 'Weg 1', 'Stadt']);
  });

  test('draws the logo at the top left when there is one (the sender block of the report)', async () => {
    const { doc } = await run({ sender: { ...invoice().sender, logo: Buffer.from('png') } });

    expect(doc.calls[0].x).toBe(220);
  });

  test('many lines continue on a new page, which repeats the column titles, and the totals follow the last line', async () => {
    const lines = Array.from({ length: 70 }, (_, index) => ({ name: `Projekt ${index + 1}`, minutes: 60, rateCents: 8000, cents: 8000 }));

    const { doc } = await run({ lines, netCents: 560000, vatCents: 106400, grossCents: 666400 });

    expect(doc.pageNumber).toBeGreaterThan(1);
    const titlesOnPage = (page) => doc.calls.filter((c) => c.page === page && c.value === 'Description').length;
    expect(titlesOnPage(1)).toBe(1);
    expect(titlesOnPage(2)).toBe(1);
    const total = doc.calls.find((c) => c.value === 'Total amount');
    const lastLine = doc.calls.filter((c) => c.value === 'Projekt 70').at(-1);
    expect(total.page).toBeGreaterThanOrEqual(lastLine.page);
    expect(total.y).toBeLessThan(842 - 50);
  });

  test('the totals move to a new page when they do not fit under the last line', async () => {
    // Enough rows to end close above the bottom margin
    const lines = Array.from({ length: 52 }, (_, index) => ({ name: `Projekt ${index + 1}`, minutes: 60, rateCents: 8000, cents: 8000 }));
    const { doc } = await run({ lines });

    const total = doc.calls.find((c) => c.value === 'Total amount');
    expect(total.y + 16).toBeLessThanOrEqual(842 - 50 + 16);
    for (const call of doc.calls) expect(call.y === undefined || call.y <= 842).toBe(true);
  });

  test('a long project name wraps inside its column and does not push the numbers away', async () => {
    const { doc } = await run({ lines: [{ name: 'x'.repeat(200), minutes: 60, rateCents: 8000, cents: 8000 }] });

    const name = doc.calls.find((c) => c.value === 'x'.repeat(200));
    expect(name.options.width).toBe(255);
    expect(doc.calls.find((c) => c.value.startsWith('€80')).x).toBe(375);
  });

  test('an unknown language falls back to German, like the reports', async () => {
    const { texts } = await run({}, 'fr');

    expect(texts).toContain('RECHNUNG');
  });

  test('rejects when the library throws', async () => {
    await expect(generateInvoicePDF(invoice({ lines: null }), { locale: 'en' })).rejects.toThrow();
  });
});
