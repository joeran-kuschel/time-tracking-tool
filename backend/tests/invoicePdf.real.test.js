const zlib = require('zlib');
const { generateInvoicePDF } = require('../src/utils/invoicePdf');
const { generateReportPDF } = require('../src/utils/pdfGenerator');
const { png } = require('./helpers/images');

// The PDF's objects as text, with its compressed streams unpacked (see pdfGenerator.real.test.js)
function pdfText(pdf) {
  const raw = pdf.toString('latin1');
  const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(([, data]) => {
    try {
      return zlib.inflateSync(Buffer.from(data, 'latin1')).toString('latin1');
    } catch {
      return '';
    }
  });
  return [raw, ...streams].join('\n');
}

const invoice = (overrides = {}) => ({
  number: '2026-0007',
  invoiceDate: '2026-03-05',
  periodFrom: '2026-02-01',
  periodTo: '2026-02-28',
  customer: { name: 'Łódź Media GmbH', address: 'Grüne Straße 1\n12345 Musterstadt', taxId: 'DE999999999' },
  sender: { name: 'Jana Beispiel', address: 'Beispielstr. 5\n54321 Beispielstadt', email: 'jana@example.test', taxId: '12/345/67890', bankDetails: 'DE89 3704 0044 0532 0130 00' },
  vatMode: 'regular',
  vatRate: 19,
  lines: [{ name: 'Webseite Größe', minutes: 750, rateCents: 8000, cents: 100000 }],
  netCents: 100000,
  vatCents: 19000,
  grossCents: 119000,
  ...overrides,
});

const pages = (pdf) => (pdfText(pdf).match(/\/Type \/Page\b/g) ?? []).length;

test('produces a real PDF in both languages, with the actual pdfkit', async () => {
  for (const locale of ['de', 'en']) {
    const pdf = await generateInvoicePDF(invoice(), { locale });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
  }
});

test('embeds IBM Plex Sans with the letters of "Łódź" and "ü", which Helvetica lacks', async () => {
  const text = pdfText(await generateInvoicePDF(invoice(), { locale: 'de' }));

  expect(text).toMatch(/\/BaseFont \/[A-Z]{6}\+IBMPlexSans\b/);
  expect(text).not.toMatch(/Helvetica/);
  expect(text).toMatch(/<0141>/);
  expect(text).toMatch(/<00fc>/i);
});

test('draws a real PNG as the logo, and one page is enough for a short invoice', async () => {
  const withLogo = await generateInvoicePDF(invoice({ sender: { ...invoice().sender, logo: png(120, 40) } }), { locale: 'en' });
  const without = await generateInvoicePDF(invoice(), { locale: 'en' });

  expect(withLogo.length).toBeGreaterThan(without.length);
  expect(pages(withLogo)).toBe(1);
});

test('a logo that cannot be drawn is left out, the invoice is still made', async () => {
  const pdf = await generateInvoicePDF(invoice({ sender: { ...invoice().sender, logo: Buffer.from('not an image') } }), { locale: 'en' });

  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
});

test('a small business invoice and one without bank details are real PDFs too', async () => {
  const small = await generateInvoicePDF(invoice({ vatMode: 'small_business', vatCents: 0, grossCents: 100000, sender: { ...invoice().sender, bankDetails: null } }), { locale: 'de' });

  expect(small.subarray(0, 5).toString()).toBe('%PDF-');
});

test('a long invoice runs over several pages', async () => {
  const lines = Array.from({ length: 80 }, (_, index) => ({ name: `Projekt ${index + 1}`, minutes: 60, rateCents: 8000, cents: 8000 }));

  const pdf = await generateInvoicePDF(invoice({ lines, netCents: 640000, vatCents: 121600, grossCents: 761600 }), { locale: 'en' });

  expect(pages(pdf)).toBeGreaterThan(1);
});

test('the report is not changed by the tax ID line of the sender block: it has none', async () => {
  const entries = [{ start_time: '2026-03-02T08:00:00Z', end_time: '2026-03-02T09:30:00Z', project_name: 'Website', description: 'Konzept' }];
  const sender = { name: 'Jana Beispiel', address: 'Musterweg 1', email: 'jana@example.test' };

  const a = await generateReportPDF(entries, { customerName: 'Muster', month: 3, year: 2026, locale: 'en', sender });
  const b = await generateReportPDF(entries, { customerName: 'Muster', month: 3, year: 2026, locale: 'en', sender: { ...sender, taxId: null } });

  expect(pages(a)).toBe(pages(b));
  expect(pdfText(a)).not.toMatch(/Tax ID/);
});

describe('the longest values the database allows', () => {
  const longest = () => invoice({
    customer: { name: 'K'.repeat(255), address: Array.from({ length: 6 }, (_, i) => `${i}`.repeat(48)).join('\n').slice(0, 300), taxId: 'T'.repeat(30) },
    sender: { name: 'S'.repeat(100), address: 'A'.repeat(300), email: `${'e'.repeat(240)}@example.test`, taxId: 'X'.repeat(30), bankDetails: Array.from({ length: 4 }, () => 'B'.repeat(74)).join('\n') },
    lines: [{ name: 'P'.repeat(255), minutes: 59999, rateCents: 99999999, cents: 99999999 }],
    netCents: 99999999, vatCents: 18999999, grossCents: 118999998,
  });

  test.each(['de', 'en'])('names without a space, a 300-character address and 4 bank lines still make a PDF (%s)', async (locale) => {
    const pdf = await generateInvoicePDF(longest(), { locale });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
