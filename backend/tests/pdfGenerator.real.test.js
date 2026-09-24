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
