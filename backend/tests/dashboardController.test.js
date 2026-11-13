jest.mock('../src/models/TimeEntry');
jest.mock('../src/models/Project');
jest.mock('../src/models/ReportStatus');
jest.mock('../src/models/Settings');

const TimeEntry = require('../src/models/TimeEntry');
const Project = require('../src/models/Project');
const ReportStatus = require('../src/models/ReportStatus');
const Settings = require('../src/models/Settings');
const controller = require('../src/controllers/dashboardController');
const router = require('../src/routes/dashboard');

function mockResponse() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

const query = { from: '2026-08-31T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z', month: '9', year: '2026' };

describe('dashboardController.get', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    TimeEntry.getInRange.mockResolvedValue([{ id: 1 }]);
    TimeEntry.getRecent.mockResolvedValue([{ id: 2 }]);
    Project.getAllWithCustomer.mockResolvedValue([{ id: 3 }]);
    ReportStatus.forMonth.mockResolvedValue([{ customer_id: 4, status: 'sent' }]);
    Settings.get.mockResolvedValue({ showAmounts: false, roundingMinutes: 0, roundingDirection: 'up', showRoundingNote: false });
  });

  test('returns the entries of the range, recent entries, projects and last month\'s reports', async () => {
    const res = mockResponse();

    await controller.get({ query }, res);

    expect(TimeEntry.getInRange).toHaveBeenCalledWith(query.from, query.to);
    expect(TimeEntry.getRecent).toHaveBeenCalledWith(5);
    expect(ReportStatus.forMonth).toHaveBeenCalledWith(2026, 8, { from: '2026-08-01T00:00:00.000Z', to: '2026-09-01T00:00:00.000Z' });
    expect(res.json).toHaveBeenCalledWith({
      entries: [{ id: 1 }],
      recent: [{ id: 2 }],
      projects: [{ id: 3 }],
      lastMonthReports: { month: 8, year: 2026, reports: [{ customer_id: 4, status: 'sent' }] },
    });
  });

  test('takes December of the year before for January', async () => {
    await controller.get({ query: { ...query, month: '1' } }, mockResponse());

    expect(ReportStatus.forMonth).toHaveBeenCalledWith(2025, 12, expect.anything());
  });

  test('limits last month by the browser\'s time zone', async () => {
    await controller.get({ query: { ...query, tz: 'Europe/Berlin' } }, mockResponse());

    expect(ReportStatus.forMonth).toHaveBeenCalledWith(2026, 8, { from: '2026-07-31T22:00:00.000Z', to: '2026-08-31T22:00:00.000Z' });
  });

  test.each([
    { from: undefined }, { to: 'not a date' }, { from: query.to, to: query.from }, { month: '13' }, { year: undefined },
  ])('answers 400 for %p', async (change) => {
    const res = mockResponse();

    await controller.get({ query: { ...query, ...change } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TimeEntry.getInRange).not.toHaveBeenCalled();
  });

  test('answers 500 when the database fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    TimeEntry.getInRange.mockRejectedValue(new Error('down'));
    const res = mockResponse();

    await controller.get({ query }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

test('serves the dashboard at the router root', () => {
  const route = router.stack.find((layer) => layer.route?.path === '/');
  expect(route.route.methods.get).toBe(true);
});

describe('dashboardController.get with a rounding rule', () => {
  const entry = (id, minutes, rate = '80.00') => ({
    id, project_id: 7, project_name: 'Web', hourly_rate: rate, customer_id: 1, customer_name: 'Muster',
    start_time: '2026-09-21T08:00:00Z', end_time: new Date(Date.UTC(2026, 8, 21, 8, minutes)).toISOString(),
  });
  const rule = (roundingMinutes, roundingDirection) =>
    Settings.get.mockResolvedValue({ showAmounts: false, roundingMinutes, roundingDirection, showRoundingNote: false });

  beforeEach(() => {
    jest.clearAllMocks();
    TimeEntry.getInRange.mockResolvedValue([entry(1, 65), entry(2, 20)]);
    TimeEntry.getRecent.mockResolvedValue([entry(3, 65)]);
    Project.getAllWithCustomer.mockResolvedValue([{ id: 7 }]);
    ReportStatus.forMonth.mockResolvedValue([]);
  });

  test('adds billed_hours, billed_amount and the rule that produced them to the entries of the range', async () => {
    rule(15, 'up');
    const res = mockResponse();

    await controller.get({ query }, res);

    const body = res.json.mock.calls[0][0];
    expect(body).not.toHaveProperty('rounding');
    expect(body.entries.map((e) => e.billed_rule)).toEqual([{ minutes: 15, direction: 'up' }, { minutes: 15, direction: 'up' }]);
    expect(body.entries.map((e) => [e.billed_hours, e.billed_amount])).toEqual([['1.25', '100.00'], ['0.50', '40.00']]);
    // the entries stay exact
    expect(body.entries[0].end_time).toBe(entry(1, 65).end_time);
  });

  test('never rounds the recent entries', async () => {
    rule(30, 'nearest');
    const res = mockResponse();

    await controller.get({ query }, res);

    const { recent } = res.json.mock.calls[0][0];
    expect(recent).toEqual([entry(3, 65)]);
    expect(recent[0]).not.toHaveProperty('billed_hours');
  });

  test('uses the rule of the settings: to the nearest half hour', async () => {
    rule(30, 'nearest');
    const res = mockResponse();

    await controller.get({ query }, res);

    const body = res.json.mock.calls[0][0];
    expect(body.entries.map((e) => e.billed_rule)).toEqual([{ minutes: 30, direction: 'nearest' }, { minutes: 30, direction: 'nearest' }]);
    expect(body.entries.map((e) => e.billed_hours)).toEqual(['1.00', '0.50']);
  });

  test('without a rule the answer is as before: no billed fields and no rounding', async () => {
    rule(0, 'up');
    const res = mockResponse();

    await controller.get({ query }, res);

    const body = res.json.mock.calls[0][0];
    expect(body).not.toHaveProperty('rounding');
    expect(body.entries).toEqual([entry(1, 65), entry(2, 20)]);
    expect(Object.keys(body).sort()).toEqual(['entries', 'lastMonthReports', 'projects', 'recent']);
  });

  test('answers 500 when the settings can not be read', async () => {
    Settings.get.mockRejectedValue(new Error('down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockResponse();

    await controller.get({ query }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    console.error.mockRestore();
  });
});

describe('dashboardController.get with the rounding rules of customers', () => {
  const entry = (id, customer, minutes, own = {}) => ({
    id, project_id: customer, project_name: 'Web', hourly_rate: '80.00', customer_id: customer, customer_name: `K${customer}`,
    start_time: '2026-09-21T08:00:00Z', end_time: new Date(Date.UTC(2026, 8, 21, 8, minutes)).toISOString(),
    customer_rounding_minutes: null, customer_rounding_direction: null, ...own,
  });
  const settings = (roundingMinutes) =>
    Settings.get.mockResolvedValue({ showAmounts: false, roundingMinutes, roundingDirection: 'up', showRoundingNote: false });

  beforeEach(() => {
    jest.clearAllMocks();
    TimeEntry.getRecent.mockResolvedValue([]);
    Project.getAllWithCustomer.mockResolvedValue([]);
    ReportStatus.forMonth.mockResolvedValue([]);
  });

  test('each entry is billed by the rule of its customer', async () => {
    settings(15);
    TimeEntry.getInRange.mockResolvedValue([
      entry(1, 1, 65),
      entry(2, 2, 65, { customer_rounding_minutes: 60, customer_rounding_direction: 'up' }),
      entry(3, 3, 65, { customer_rounding_minutes: 0, customer_rounding_direction: 'up' }),
    ]);
    const res = mockResponse();

    await controller.get({ query }, res);

    const { entries } = res.json.mock.calls[0][0];
    expect(entries.map((e) => [e.billed_hours, e.billed_amount])).toEqual([['1.25', '100.00'], ['2.00', '160.00'], [null, null]]);
    expect(entries.map((e) => e.billed_rule)).toEqual([{ minutes: 15, direction: 'up' }, { minutes: 60, direction: 'up' }, null]);
  });

  test('an own rule rounds although the global setting is off, the others stay exact', async () => {
    settings(0);
    TimeEntry.getInRange.mockResolvedValue([entry(1, 1, 65), entry(2, 2, 65, { customer_rounding_minutes: 30, customer_rounding_direction: 'nearest' })]);
    const res = mockResponse();

    await controller.get({ query }, res);

    const { entries } = res.json.mock.calls[0][0];
    expect(entries.map((e) => e.billed_hours)).toEqual([null, '1.00']);
    expect(entries.map((e) => e.billed_rule)).toEqual([null, { minutes: 30, direction: 'nearest' }]);
  });
});
