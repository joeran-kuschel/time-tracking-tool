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

describe('reportController amounts flag', () => {
  const entries = [
    { id: 1, project_id: 1, project_name: 'Web', hourly_rate: '80.00', start_time: '2026-03-02T08:00:00Z', end_time: '2026-03-02T09:30:00Z', description: 'x' },
    { id: 2, project_id: 2, project_name: 'Free', hourly_rate: '0.00', start_time: '2026-03-03T08:00:00Z', end_time: '2026-03-03T08:20:00Z', description: null },
    { id: 3, project_id: 1, project_name: 'Web', hourly_rate: '80.00', start_time: '2026-03-04T08:00:00Z', end_time: null, description: null },
  ];
  const request = (query = {}) => ({ params: { customerId: '1' }, query: { month: '3', year: '2026', ...query } });
  const BAD = [{ amounts: '2' }, { amounts: '' }, { amounts: 'abc' }, { amounts: ['1', '1'] }, { amounts: ['0', '1'] }];

  beforeEach(() => {
    Customer.getById.mockReset().mockResolvedValue({ id: 1, name: 'Muster' });
    TimeEntry.getByCustomerIdInRange.mockReset().mockResolvedValue(entries);
    ReportStatus.get.mockReset().mockResolvedValue('draft');
    generateReportPDF.mockClear();
  });

  test.each(BAD)('answers 400 for %p on the PDF, the CSV and the JSON report', async (change) => {
    for (const handler of [controller.generatePDF, controller.exportCsv, controller.getMonthlyReport]) {
      const res = mockResponse();

      await handler(request(change), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'amounts must be 0 or 1' });
      expect(res.send).not.toHaveBeenCalled();
    }
    expect(generateReportPDF).not.toHaveBeenCalled();
  });

  test('checks the flag before the period everywhere: month=13&amounts=2 answers the amounts error', async () => {
    for (const handler of [controller.generatePDF, controller.exportCsv, controller.getMonthlyReport]) {
      const res = mockResponse();

      await handler(request({ month: '13', amounts: '2' }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'amounts must be 0 or 1' });
    }
    expect(Customer.getById).not.toHaveBeenCalled();
    expect(TimeEntry.getByCustomerIdInRange).not.toHaveBeenCalled();
  });

  test('passes the flag to the PDF only when it is on', async () => {
    await controller.generatePDF(request({ amounts: '1' }), mockResponse());
    await controller.generatePDF(request({ amounts: '0' }), mockResponse());
    await controller.generatePDF(request(), mockResponse());

    expect(generateReportPDF.mock.calls[0][1]).toEqual(expect.objectContaining({ amounts: true }));
    expect(generateReportPDF.mock.calls[1][1]).not.toHaveProperty('amounts');
    expect(generateReportPDF.mock.calls[2][1]).not.toHaveProperty('amounts');
  });

  test('adds the columns to the CSV only when the flag is on', async () => {
    const on = mockResponse();
    const off = mockResponse();

    await controller.exportCsv(request({ lang: 'en', amounts: '1' }), on);
    await controller.exportCsv(request({ lang: 'en', amounts: '0' }), off);

    expect(on.send.mock.calls[0][0].split('\r\n')[0]).toBe('﻿Date,Start,End,Customer,Project,Description,Hours,Rate (EUR/h),Amount (EUR)');
    expect(off.send.mock.calls[0][0].split('\r\n')[0]).toBe('﻿Date,Start,End,Customer,Project,Description,Hours');
  });

  test('the JSON report has amounts, currency, total and projects with the flag', async () => {
    const res = mockResponse();

    await controller.getMonthlyReport(request({ amounts: '1' }), res);

    const body = res.json.mock.calls[0][0];
    expect(body.currency).toBe('EUR');
    expect(body.totalAmount).toBe('120.00');
    expect(body.entries.map((entry) => entry.amount)).toEqual(['120.00', '0.00', '0.00']);
    expect(body.entries[0]).toEqual({ ...entries[0], amount: '120.00' });
    expect(body.projects).toEqual([
      { projectId: 1, name: 'Web', hours: '1.50', hourlyRate: '80.00', amount: '120.00' },
      { projectId: 2, name: 'Free', hours: '0.33', hourlyRate: '0.00', amount: '0.00' },
    ]);
    expect(body.totalHours).toBe('1.83');
  });

  test('the JSON report is unchanged without the flag, or with 0', async () => {
    for (const query of [request(), request({ amounts: '0' })]) {
      const res = mockResponse();

      await controller.getMonthlyReport(query, res);

      const body = res.json.mock.calls[0][0];
      expect(Object.keys(body)).toEqual(['customerId', 'month', 'year', 'status', 'entries', 'totalHours']);
      expect(body.entries).toBe(entries);
    }
  });
});

describe('reportController amounts flag: parsing and order of checks', () => {
  const request = (query) => ({ params: { customerId: '1' }, query: { month: '3', year: '2026', ...query } });
  const entries = [{ id: 1, project_id: 1, project_name: 'Web', hourly_rate: '80.00', start_time: '2026-03-02T08:00:00Z', end_time: '2026-03-02T09:00:00Z', description: null }];

  beforeEach(() => {
    jest.resetAllMocks();
    Customer.getById.mockResolvedValue({ id: 1, name: 'Muster' });
    TimeEntry.getByCustomerIdInRange.mockResolvedValue(entries);
    ReportStatus.get.mockResolvedValue('draft');
    generateReportPDF.mockResolvedValue(Buffer.from('%PDF-'));
  });

  test.each(['01', 'true', 'TRUE', '1 ', ' 1', 'yes', 'on', '-1', '1.0'])('rejects %p with 400 and reads nothing from the database', async (amounts) => {
    for (const handler of [controller.generatePDF, controller.exportCsv, controller.getMonthlyReport]) {
      const res = mockResponse();

      await handler(request({ amounts }), res);

      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(Customer.getById).not.toHaveBeenCalled();
    expect(TimeEntry.getByCustomerIdInRange).not.toHaveBeenCalled();
    expect(ReportStatus.get).not.toHaveBeenCalled();
  });

  test('rejects the flag before it answers 404 for an unknown customer or an empty month', async () => {
    Customer.getById.mockResolvedValue(undefined);
    const unknown = mockResponse();
    await controller.exportCsv(request({ amounts: 'x' }), unknown);
    TimeEntry.getByCustomerIdInRange.mockResolvedValue([]);
    const empty = mockResponse();
    await controller.generatePDF(request({ amounts: '2' }), empty);

    expect(unknown.status).toHaveBeenCalledWith(400);
    expect(empty.status).toHaveBeenCalledWith(400);
  });

  test('still answers 404 with a valid flag for an unknown customer or an empty month', async () => {
    Customer.getById.mockResolvedValueOnce(undefined);
    const unknown = mockResponse();
    await controller.exportCsv(request({ amounts: '1' }), unknown);
    TimeEntry.getByCustomerIdInRange.mockResolvedValue([]);
    const empty = mockResponse();
    await controller.generatePDF(request({ amounts: '1' }), empty);

    expect(unknown.status).toHaveBeenCalledWith(404);
    expect(empty.status).toHaveBeenCalledWith(404);
  });

  test('answers a bad period with the period error, not the flag error, when the flag is fine', async () => {
    const res = mockResponse();

    await controller.getMonthlyReport(request({ month: '13', amounts: '1' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'month (1-12) and year are required' });
  });

  test('gives the JSON report amounts as strings with two decimals, also for thousands', async () => {
    TimeEntry.getByCustomerIdInRange.mockResolvedValue([
      { ...entries[0], end_time: '2026-03-02T17:30:00Z', hourly_rate: '165.89' },
      { ...entries[0], id: 2, start_time: '2026-03-03T08:00:00Z', end_time: '2026-03-03T18:00:00Z', hourly_rate: '165.89' },
    ]);
    const res = mockResponse();

    await controller.getMonthlyReport(request({ amounts: '1' }), res);

    const body = res.json.mock.calls[0][0];
    // 9.50 h x 165.89 = 1575.955 -> 1575.96, 10 h = 1658.90
    expect(body.entries.map((e) => e.amount)).toEqual(['1575.96', '1658.90']);
    expect(body.totalAmount).toBe('3234.86');
    expect(body.projects).toEqual([{ projectId: 1, name: 'Web', hours: '19.50', hourlyRate: '165.89', amount: '3234.86' }]);
  });

  test('the JSON report of an empty month with the flag has a total of 0.00 and no projects', async () => {
    TimeEntry.getByCustomerIdInRange.mockResolvedValue([]);
    const res = mockResponse();

    await controller.getMonthlyReport(request({ amounts: '1' }), res);

    expect(res.json.mock.calls[0][0]).toEqual(expect.objectContaining({ totalAmount: '0.00', projects: [], currency: 'EUR' }));
  });
});

describe('reportController with an entry that ends before it starts', () => {
  const backwards = { id: 1, project_id: 1, project_name: 'Web', hourly_rate: '80.00', start_time: '2026-03-02T09:00:00Z', end_time: '2026-03-02T08:00:00Z', description: null };
  const normal = { id: 2, project_id: 1, project_name: 'Web', hourly_rate: '80.00', start_time: '2026-03-03T08:00:00Z', end_time: '2026-03-03T09:30:00Z', description: null };
  const request = (query = {}) => ({ params: { customerId: '1' }, query: { month: '3', year: '2026', lang: 'en', ...query } });

  beforeEach(() => {
    Customer.getById.mockReset().mockResolvedValue({ id: 1, name: 'Muster' });
    TimeEntry.getByCustomerIdInRange.mockReset().mockResolvedValue([backwards, normal]);
    ReportStatus.get.mockReset().mockResolvedValue('draft');
  });

  test('the JSON amounts count it as 0 hours and 0 amount', async () => {
    const res = mockResponse();

    await controller.getMonthlyReport(request({ amounts: '1' }), res);

    const body = res.json.mock.calls[0][0];
    expect(body.entries.map((entry) => entry.amount)).toEqual(['0.00', '120.00']);
    expect(body.projects).toEqual([{ projectId: 1, name: 'Web', hours: '1.50', hourlyRate: '80.00', amount: '120.00' }]);
    expect(body.totalAmount).toBe('120.00');
  });

  test('the JSON without the flag is unchanged: the entries as they are and the negative hour in totalHours', async () => {
    const res = mockResponse();

    await controller.getMonthlyReport(request(), res);

    const body = res.json.mock.calls[0][0];
    expect(body.entries).toEqual([backwards, normal]);
    expect(body.totalHours).toBe('0.50');
    expect(body).not.toHaveProperty('projects');
  });

  test('the CSV without the flag still prints the negative hours', async () => {
    const res = mockResponse();

    await controller.exportCsv(request(), res);

    expect(res.send.mock.calls[0][0].split('\r\n')[1]).toBe('2026-03-02,09:00,08:00,Muster,Web,,-1.00');
  });

  test('the CSV with amounts prints the negative hours but an amount of 0', async () => {
    const res = mockResponse();

    await controller.exportCsv(request({ amounts: '1' }), res);

    expect(res.send.mock.calls[0][0].split('\r\n')[1]).toBe('2026-03-02,09:00,08:00,Muster,Web,,-1.00,80.00,0.00');
  });
});
