jest.mock('../src/models/TimeEntry');
jest.mock('../src/models/Customer');
jest.mock('../src/models/ReportStatus', () => ({
  get: jest.fn(),
  set: jest.fn(),
  STATUSES: ['draft', 'ready', 'sent'],
}));
jest.mock('../src/utils/pdfGenerator', () => ({
  ...jest.requireActual('../src/utils/pdfGenerator'),
  generateReportPDF: jest.fn().mockResolvedValue(Buffer.from('%PDF-')),
}));

const TimeEntry = require('../src/models/TimeEntry');
const Customer = require('../src/models/Customer');
const ReportStatus = require('../src/models/ReportStatus');
const { generateReportPDF } = require('../src/utils/pdfGenerator');
const controller = require('../src/controllers/reportController');
const router = require('../src/routes/reports');

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

describe('reportController.generatePDF preview', () => {
  beforeEach(() => {
    Customer.getById.mockResolvedValue({ id: 1, name: 'Muster' });
    TimeEntry.getByCustomerIdAndMonth.mockResolvedValue([{ id: 1 }]);
  });

  test('sends the PDF inline with inline=1, so the browser shows it', async () => {
    const res = mockResponse();

    await controller.generatePDF({ params: { customerId: '1' }, query: { month: '3', year: '2026', lang: 'en', inline: '1' } }, res);

    expect(res.headers['Content-Disposition']).toBe('inline; filename="time-report-Muster-2026-3.pdf"');
  });
});

describe('reportController.getMonthlyReport', () => {
  test('includes the status of the report', async () => {
    TimeEntry.getByCustomerIdAndMonth.mockResolvedValue([]);
    ReportStatus.get.mockResolvedValue('ready');
    const res = mockResponse();

    await controller.getMonthlyReport({ params: { customerId: '1' }, query: { month: '8', year: '2026' } }, res);

    expect(ReportStatus.get).toHaveBeenCalledWith('1', 2026, 8);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready', month: 8, year: 2026 }));
  });
});

describe('reportController.setStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Customer.getById.mockResolvedValue({ id: 1, name: 'Muster' });
    ReportStatus.set.mockImplementation(async (customerId, year, month, status) => ({ customer_id: 1, year, month, status }));
  });

  test('stores the status of a customer\'s month', async () => {
    const res = mockResponse();

    await controller.setStatus({ params: { customerId: '1' }, body: { month: 8, year: 2026, status: 'sent' } }, res);

    expect(ReportStatus.set).toHaveBeenCalledWith('1', 2026, 8, 'sent');
    expect(res.json).toHaveBeenCalledWith({ customer_id: 1, year: 2026, month: 8, status: 'sent' });
  });

  test.each([
    { status: 'paid' }, { status: undefined }, { month: 13 }, { year: undefined },
  ])('answers 400 for %p', async (change) => {
    const res = mockResponse();

    await controller.setStatus({ params: { customerId: '1' }, body: { month: 8, year: 2026, status: 'sent', ...change } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ReportStatus.set).not.toHaveBeenCalled();
  });

  test('answers 404 for an unknown customer', async () => {
    Customer.getById.mockResolvedValue(undefined);
    const res = mockResponse();

    await controller.setStatus({ params: { customerId: '9' }, body: { month: 8, year: 2026, status: 'sent' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('is served as PUT /customer/:customerId/status', () => {
    const route = router.stack.find((layer) => layer.route?.path === '/customer/:customerId/status');
    expect(route.route.methods.put).toBe(true);
  });
});
