jest.mock('../src/models/TimeEntry');
jest.mock('../src/models/Customer');
jest.mock('../src/utils/pdfGenerator', () => ({
  ...jest.requireActual('../src/utils/pdfGenerator'),
  generateReportPDF: jest.fn().mockResolvedValue(Buffer.from('%PDF-')),
}));

const TimeEntry = require('../src/models/TimeEntry');
const Customer = require('../src/models/Customer');
const { generateReportPDF } = require('../src/utils/pdfGenerator');
const controller = require('../src/controllers/reportController');

function mockResponse() {
  const res = { headers: {} };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.contentType = jest.fn(() => res);
  res.setHeader = jest.fn((name, value) => { res.headers[name] = value; });
  res.send = jest.fn(() => res);
  return res;
}

describe('reportController.generatePDF', () => {
  beforeEach(() => {
    Customer.getById.mockResolvedValue({ id: 1, name: 'Muster' });
    TimeEntry.getByCustomerIdAndMonth.mockResolvedValue([{ id: 1 }]);
  });

  test('generates the PDF and its file name in the requested language', async () => {
    const res = mockResponse();

    await controller.generatePDF({ params: { customerId: '1' }, query: { month: '3', year: '2026', lang: 'en' } }, res);

    expect(generateReportPDF).toHaveBeenCalledWith([{ id: 1 }], 'Muster', '3', '2026', 'en');
    expect(res.headers['Content-Disposition']).toBe('attachment; filename="time-report-Muster-2026-3.pdf"');
  });

  test('keeps the German file name without a language', async () => {
    const res = mockResponse();

    await controller.generatePDF({ params: { customerId: '1' }, query: { month: '3', year: '2026' } }, res);

    expect(res.headers['Content-Disposition']).toBe('attachment; filename="abrechnung-Muster-2026-3.pdf"');
  });
});
