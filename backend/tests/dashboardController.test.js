jest.mock('../src/models/TimeEntry');
jest.mock('../src/models/Project');
jest.mock('../src/models/ReportStatus');

const TimeEntry = require('../src/models/TimeEntry');
const Project = require('../src/models/Project');
const ReportStatus = require('../src/models/ReportStatus');
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
