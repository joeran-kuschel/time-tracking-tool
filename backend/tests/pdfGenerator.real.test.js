const { generateReportPDF } = require('../src/utils/pdfGenerator');

test('produces a real PDF with the actual pdfkit', async () => {
  const entries = [{ start_time: '2026-03-02T08:00:00Z', end_time: '2026-03-02T09:30:00Z', project_name: 'Website', description: 'Umlaute äöü' }];
  for (const locale of ['de', 'en']) {
    const pdf = await generateReportPDF(entries, 'Muster GmbH', 3, 2026, locale);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
  }
});
