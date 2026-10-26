const zlib = require('zlib');
const { generateReportPDF } = require('../src/utils/pdfGenerator');

// The PDF's objects as text, with its compressed streams (content, fonts, character maps) unpacked
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

test('produces a real PDF with the actual pdfkit', async () => {
  const entries = [{ start_time: '2026-03-02T08:00:00Z', end_time: '2026-03-02T09:30:00Z', project_name: 'Website', description: 'Umlaute äöü' }];
  for (const locale of ['de', 'en']) {
    const pdf = await generateReportPDF(entries, { customerName: 'Muster GmbH', month: 3, year: 2026, locale });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
  }
});

test('embeds IBM Plex Sans with the letters of "Łódź", which Helvetica lacks', async () => {
  const entries = [{ start_time: '2026-03-02T08:00:00Z', end_time: '2026-03-02T09:30:00Z', project_name: 'Website', description: 'Grüße' }];

  const text = pdfText(await generateReportPDF(entries, { customerName: 'Łódź Media', month: 3, year: 2026, locale: 'de' }));

  expect(text).toMatch(/\/BaseFont \/[A-Z]{6}\+IBMPlexSans\b/);
  expect(text).toMatch(/\/BaseFont \/[A-Z]{6}\+IBMPlexSans-SmBld\b/);
  expect(text).not.toMatch(/Helvetica/);
  // The character maps tell PDF readers which letter each glyph is: Ł is U+0141, ź is U+017A
  expect(text).toMatch(/<0141>/);
  expect(text).toMatch(/<017a>/i);
});

describe('a real PDF with amounts', () => {
  const rows = Array.from({ length: 70 }, (_, i) => ({
    project_id: i % 3,
    hourly_rate: ['80.00', '0.00', '33.33'][i % 3],
    project_name: ['Website', 'Gratis', 'App'][i % 3],
    start_time: `2026-03-${String((i % 28) + 1).padStart(2, '0')}T08:00:00Z`,
    end_time: `2026-03-${String((i % 28) + 1).padStart(2, '0')}T08:20:00Z`,
    description: `Eintrag ${i}`,
  }));

  test('embeds the euro sign, which the shipped font has', async () => {
    const text = pdfText(await generateReportPDF(rows, { customerName: 'Muster GmbH', month: 3, year: 2026, locale: 'de', amounts: true }));

    // The character map lists U+20AC for the glyph that shows "€"
    expect(text).toMatch(/<20ac>/i);
    expect(text).toMatch(/\/BaseFont \/[A-Z]{6}\+IBMPlexSans\b/);
  });

  test('is longer than one page, with and without amounts', async () => {
    const withAmounts = await generateReportPDF(rows, { customerName: 'Muster GmbH', month: 3, year: 2026, locale: 'en', amounts: true });
    const without = await generateReportPDF(rows, { customerName: 'Muster GmbH', month: 3, year: 2026, locale: 'en' });
    const pageCount = (pdf) => (pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;

    expect(pageCount(withAmounts)).toBeGreaterThan(1);
    expect(pageCount(withAmounts)).toBeGreaterThanOrEqual(pageCount(without));
  });

  test('has no euro sign without amounts', async () => {
    const text = pdfText(await generateReportPDF(rows, { customerName: 'Muster GmbH', month: 3, year: 2026, locale: 'de' }));

    expect(text).not.toMatch(/<20ac>/i);
  });
});
