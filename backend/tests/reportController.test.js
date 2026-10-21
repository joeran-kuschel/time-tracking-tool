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
    TimeEntry.getByCustomerIdInRange.mockResolvedValue([{ id: 1 }]);
  });

  test('generates the PDF and its file name in the requested language', async () => {
    const res = mockResponse();

    await controller.generatePDF({ params: { customerId: '1' }, query: { month: '3', year: '2026', lang: 'en' } }, res);

    expect(generateReportPDF).toHaveBeenCalledWith([{ id: 1 }], { customerName: 'Muster', month: 3, year: 2026, locale: 'en', timeZone: 'UTC' });
    expect(res.headers['Content-Disposition']).toBe('attachment; filename=time-report-Muster-2026-3.pdf');
  });

  test('keeps the German file name without a language', async () => {
    const res = mockResponse();

    await controller.generatePDF({ params: { customerId: '1' }, query: { month: '3', year: '2026' } }, res);

    expect(res.headers['Content-Disposition']).toBe('attachment; filename=abrechnung-Muster-2026-3.pdf');
  });

  test.each([
    ['Łódź Media', `attachment; filename="abrechnung-??d? Media-2026-3.pdf"; filename*=UTF-8''abrechnung-%C5%81%C3%B3d%C5%BA%20Media-2026-3.pdf`],
    ['Café "Zur Post"', `attachment; filename="abrechnung-Caf? \\"Zur Post\\"-2026-3.pdf"; filename*=UTF-8''abrechnung-Caf%C3%A9%20%22Zur%20Post%22-2026-3.pdf`],
  ])('sends a valid file name for the customer %p', async (name, header) => {
    Customer.getById.mockResolvedValue({ id: 1, name });
    const res = mockResponse();

    await controller.generatePDF({ params: { customerId: '1' }, query: { month: '3', year: '2026' } }, res);

    expect(res.headers['Content-Disposition']).toBe(header);
    expect(res.send).toHaveBeenCalled();
  });

  test('takes the month and the dates in the browser\'s time zone', async () => {
    const res = mockResponse();

    await controller.generatePDF({ params: { customerId: '1' }, query: { month: '10', year: '2026', tz: 'Europe/Berlin' } }, res);

    expect(TimeEntry.getByCustomerIdInRange).toHaveBeenCalledWith('1', { from: '2026-09-30T22:00:00.000Z', to: '2026-10-31T23:00:00.000Z' });
    expect(generateReportPDF).toHaveBeenCalledWith([{ id: 1 }], expect.objectContaining({ timeZone: 'Europe/Berlin' }));
  });

  test.each([
    { month: 'abc' }, { month: '13' }, { year: undefined },
  ])('answers 400 for %p', async (change) => {
    Customer.getById.mockClear();
    const res = mockResponse();

    await controller.generatePDF({ params: { customerId: '1' }, query: { month: '3', year: '2026', ...change } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Customer.getById).not.toHaveBeenCalled();
  });
});

describe('reportController.generatePDF preview', () => {
  beforeEach(() => {
    Customer.getById.mockResolvedValue({ id: 1, name: 'Muster' });
    TimeEntry.getByCustomerIdInRange.mockResolvedValue([{ id: 1 }]);
  });

  test('sends the PDF inline with inline=1, so the browser shows it', async () => {
    const res = mockResponse();

    await controller.generatePDF({ params: { customerId: '1' }, query: { month: '3', year: '2026', lang: 'en', inline: '1' } }, res);

    expect(res.headers['Content-Disposition']).toBe('inline; filename=time-report-Muster-2026-3.pdf');
  });
});

describe('reportController.exportCsv', () => {
  const entry = { id: 1, start_time: '2026-03-02T08:00:00Z', end_time: '2026-03-02T09:30:00Z', project_name: 'Web', description: 'x' };
  const request = (query = {}) => ({ params: { customerId: '1' }, query: { month: '3', year: '2026', ...query } });

  beforeEach(() => {
    Customer.getById.mockReset().mockResolvedValue({ id: 1, name: 'Muster' });
    TimeEntry.getByCustomerIdInRange.mockReset().mockResolvedValue([entry]);
  });

  test('sends the CSV as an attachment in the requested language', async () => {
    const res = mockResponse();

    await controller.exportCsv(request({ lang: 'en' }), res);

    expect(res.contentType).toHaveBeenCalledWith('text/csv; charset=utf-8');
    expect(res.headers['Content-Disposition']).toBe('attachment; filename=time-report-Muster-2026-3.csv');
    expect(res.send.mock.calls[0][0]).toBe(
      '﻿Date,Start,End,Customer,Project,Description,Hours\r\n2026-03-02,08:00,09:30,Muster,Web,x,1.50\r\n'
    );
  });

  test('is German without a language', async () => {
    const res = mockResponse();

    await controller.exportCsv(request(), res);

    expect(res.headers['Content-Disposition']).toBe('attachment; filename=abrechnung-Muster-2026-3.csv');
    expect(res.send.mock.calls[0][0]).toBe(
      '﻿Datum;Beginn;Ende;Kunde;Projekt;Beschreibung;Stunden\r\n2026-03-02;08:00;09:30;Muster;Web;x;1,50\r\n'
    );
  });

  test('takes the month and the times in the browser\'s time zone', async () => {
    const res = mockResponse();

    await controller.exportCsv(request({ month: '10', tz: 'Europe/Berlin' }), res);

    expect(TimeEntry.getByCustomerIdInRange).toHaveBeenCalledWith('1', { from: '2026-09-30T22:00:00.000Z', to: '2026-10-31T23:00:00.000Z' });
    expect(res.send.mock.calls[0][0]).toContain('2026-03-02;09:00;10:30;');
  });

  test.each([
    ['Łódź Media', `attachment; filename="abrechnung-??d? Media-2026-3.csv"; filename*=UTF-8''abrechnung-%C5%81%C3%B3d%C5%BA%20Media-2026-3.csv`],
    ['Café "Zur Post"', `attachment; filename="abrechnung-Caf? \\"Zur Post\\"-2026-3.csv"; filename*=UTF-8''abrechnung-Caf%C3%A9%20%22Zur%20Post%22-2026-3.csv`],
  ])('sends a valid file name for the customer %p', async (name, header) => {
    Customer.getById.mockResolvedValue({ id: 1, name });
    const res = mockResponse();

    await controller.exportCsv(request(), res);

    expect(res.headers['Content-Disposition']).toBe(header);
    expect(res.send).toHaveBeenCalled();
  });

  test.each([
    { month: undefined }, { month: 'abc' }, { month: '13' }, { month: '0' }, { year: undefined }, { year: 'abc' },
  ])('answers 400 for %p without looking anything up', async (change) => {
    const res = mockResponse();

    await controller.exportCsv(request(change), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'month (1-12) and year are required' });
    expect(Customer.getById).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  test('answers 404 for an unknown customer', async () => {
    Customer.getById.mockResolvedValue(undefined);
    const res = mockResponse();

    await controller.exportCsv(request(), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Customer not found' });
    expect(TimeEntry.getByCustomerIdInRange).not.toHaveBeenCalled();
  });

  test('answers 404 for a month without entries', async () => {
    TimeEntry.getByCustomerIdInRange.mockResolvedValue([]);
    const res = mockResponse();

    await controller.exportCsv(request(), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'No time entries found for the specified month' });
    expect(res.send).not.toHaveBeenCalled();
  });

  test('answers 500 when the entries cannot be loaded', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    TimeEntry.getByCustomerIdInRange.mockRejectedValue(new Error('db down'));
    const res = mockResponse();

    await controller.exportCsv(request(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to export CSV report' });
  });

  test('is routed next to the PDF', () => {
    const paths = router.stack.filter((layer) => layer.route?.methods.get).map((layer) => layer.route.path);

    expect(paths).toContain('/customer/:customerId/csv');
  });
});

describe('reportController.getMonthlyReport', () => {
  test('includes the status of the report', async () => {
    TimeEntry.getByCustomerIdInRange.mockResolvedValue([]);
    ReportStatus.get.mockResolvedValue('ready');
    const res = mockResponse();

    await controller.getMonthlyReport({ params: { customerId: '1' }, query: { month: '8', year: '2026' } }, res);

    expect(ReportStatus.get).toHaveBeenCalledWith('1', 2026, 8);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready', month: 8, year: 2026 }));
  });

  test('loads the month in the browser\'s time zone', async () => {
    TimeEntry.getByCustomerIdInRange.mockResolvedValue([]);
    const res = mockResponse();

    await controller.getMonthlyReport({ params: { customerId: '1' }, query: { month: '10', year: '2026', tz: 'Europe/Berlin' } }, res);

    expect(TimeEntry.getByCustomerIdInRange).toHaveBeenCalledWith('1', { from: '2026-09-30T22:00:00.000Z', to: '2026-10-31T23:00:00.000Z' });
  });

  test.each([
    { month: 'abc' }, { month: '0' }, { year: '20x6' },
  ])('answers 400 for %p', async (change) => {
    TimeEntry.getByCustomerIdInRange.mockClear();
    const res = mockResponse();

    await controller.getMonthlyReport({ params: { customerId: '1' }, query: { month: '8', year: '2026', ...change } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TimeEntry.getByCustomerIdInRange).not.toHaveBeenCalled();
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
