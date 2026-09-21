jest.mock('../src/models/TimeEntry');

const TimeEntry = require('../src/models/TimeEntry');
const controller = require('../src/controllers/timeEntryController');

function mockResponse() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('timeEntryController.update', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test('passes no description to the model when the request has none (stopping the timer)', async () => {
    TimeEntry.update.mockResolvedValue({ id: 1, description: 'Konzept schreiben' });
    const res = mockResponse();

    await controller.update({ params: { id: '1' }, body: { endTime: '2026-09-21T09:00:00Z' } }, res);

    expect(TimeEntry.update).toHaveBeenCalledWith('1', '2026-09-21T09:00:00Z', undefined);
    expect(res.json).toHaveBeenCalledWith({ id: 1, description: 'Konzept schreiben' });
  });

  test('passes a given description to the model', async () => {
    TimeEntry.update.mockResolvedValue({ id: 1 });
    const res = mockResponse();

    await controller.update(
      { params: { id: '1' }, body: { endTime: '2026-09-21T09:00:00Z', description: 'Neu' } },
      res
    );

    expect(TimeEntry.update).toHaveBeenCalledWith('1', '2026-09-21T09:00:00Z', 'Neu');
  });

  test('rejects a request without endTime', async () => {
    const res = mockResponse();

    await controller.update({ params: { id: '1' }, body: {} }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TimeEntry.update).not.toHaveBeenCalled();
  });

  test('answers 500 when the database fails', async () => {
    TimeEntry.update.mockRejectedValue(new Error('connection lost'));
    const res = mockResponse();

    await controller.update({ params: { id: '1' }, body: { endTime: '2026-09-21T09:00:00Z' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to update time entry' });
  });
});

describe('timeEntryController.create', () => {
  const body = { projectId: 3, startTime: '2026-09-21T08:00:00Z', description: 'Konzept' };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('starts a timer when none is running', async () => {
    TimeEntry.getActive.mockResolvedValue(undefined);
    TimeEntry.create.mockResolvedValue({ id: 1 });
    const res = mockResponse();

    await controller.create({ body }, res);

    expect(TimeEntry.create).toHaveBeenCalledWith(3, '2026-09-21T08:00:00Z', null, 'Konzept');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('refuses a second running timer with 409', async () => {
    TimeEntry.getActive.mockResolvedValue({ id: 9 });
    const res = mockResponse();

    await controller.create({ body }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(TimeEntry.create).not.toHaveBeenCalled();
  });

  test('allows finished entries while a timer is running', async () => {
    TimeEntry.getActive.mockResolvedValue({ id: 9 });
    TimeEntry.create.mockResolvedValue({ id: 2 });
    const res = mockResponse();

    await controller.create({ body: { ...body, endTime: '2026-09-21T09:00:00Z' } }, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('timeEntryController.getActive', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test('returns the running entry', async () => {
    TimeEntry.getActive.mockResolvedValue({ id: 9, project_name: 'Website' });
    const res = mockResponse();

    await controller.getActive({}, res);

    expect(res.json).toHaveBeenCalledWith({ id: 9, project_name: 'Website' });
  });

  test('returns null when no timer is running', async () => {
    TimeEntry.getActive.mockResolvedValue(undefined);
    const res = mockResponse();

    await controller.getActive({}, res);

    expect(res.json).toHaveBeenCalledWith(null);
  });

  test('answers 500 when the database fails', async () => {
    TimeEntry.getActive.mockRejectedValue(new Error('connection lost'));
    const res = mockResponse();

    await controller.getActive({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
