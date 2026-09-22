jest.mock('../src/models/TimeEntry');
jest.mock('../src/models/Project');

const TimeEntry = require('../src/models/TimeEntry');
const Project = require('../src/models/Project');
const controller = require('../src/controllers/timeEntryController');

function mockResponse() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('timeEntryController.update', () => {
  const running = { id: 1, project_id: 3, start_time: new Date('2026-09-21T08:00:00Z'), end_time: null };
  const finished = { ...running, end_time: new Date('2026-09-21T09:00:00Z') };
  const call = async (body, entry = finished) => {
    TimeEntry.getById.mockResolvedValue(entry);
    TimeEntry.update.mockResolvedValue({ id: 1 });
    const res = mockResponse();
    await controller.update({ params: { id: '1' }, body }, res);
    return res;
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test('stops a running entry without touching the description', async () => {
    const res = await call({ endTime: '2026-09-21T09:00:00Z' }, running);

    expect(TimeEntry.update).toHaveBeenCalledWith('1', { endTime: '2026-09-21T09:00:00Z', startTime: undefined, projectId: undefined, description: undefined });
    expect(res.json).toHaveBeenCalledWith({ id: 1 });
  });

  test('does not check the end time when stopping, because the clocks may differ', async () => {
    const res = await call({ endTime: '2026-09-21T07:59:58Z' }, running);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('refuses to edit the times or project of a running entry', async () => {
    expect((await call({ endTime: '2026-09-21T09:00:00Z', startTime: '2026-09-21T07:00:00Z' }, running)).status).toHaveBeenCalledWith(409);
    expect((await call({ endTime: '2026-09-21T09:00:00Z', projectId: 4 }, running)).status).toHaveBeenCalledWith(409);
    expect(TimeEntry.update).not.toHaveBeenCalled();
  });

  test('edits start, end and description of a finished entry', async () => {
    const body = { startTime: '2026-09-21T07:30:00Z', endTime: '2026-09-21T10:00:00Z', description: 'Neu' };
    const res = await call(body);

    expect(TimeEntry.update).toHaveBeenCalledWith('1', { ...body, projectId: undefined });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('refuses an end that is not after the start', async () => {
    expect((await call({ startTime: '2026-09-21T10:00:00Z', endTime: '2026-09-21T10:00:00Z' })).status).toHaveBeenCalledWith(400);
    // without a new start, the stored start counts
    expect((await call({ endTime: '2026-09-21T07:00:00Z' })).status).toHaveBeenCalledWith(400);
    expect(TimeEntry.update).not.toHaveBeenCalled();
  });

  test('refuses invalid dates', async () => {
    expect((await call({ endTime: 'tomorrow' })).status).toHaveBeenCalledWith(400);
    expect((await call({ startTime: '31.02.2026', endTime: '2026-09-21T10:00:00Z' })).status).toHaveBeenCalledWith(400);
  });

  test('moves an entry to another project of the same customer', async () => {
    Project.getById.mockImplementation(async (id) => ({ id: Number(id), customer_id: 1 }));
    const res = await call({ endTime: '2026-09-21T09:00:00Z', projectId: 4 });

    expect(TimeEntry.update).toHaveBeenCalledWith('1', expect.objectContaining({ projectId: 4 }));
    expect(res.status).not.toHaveBeenCalled();
  });

  test('refuses to move an entry to another customer or an unknown project', async () => {
    Project.getById.mockImplementation(async (id) => (Number(id) === 3 ? { id: 3, customer_id: 1 } : { id: 4, customer_id: 2 }));
    expect((await call({ endTime: '2026-09-21T09:00:00Z', projectId: 4 })).status).toHaveBeenCalledWith(400);

    Project.getById.mockImplementation(async (id) => (Number(id) === 3 ? { id: 3, customer_id: 1 } : undefined));
    expect((await call({ endTime: '2026-09-21T09:00:00Z', projectId: 99 })).status).toHaveBeenCalledWith(400);
    expect(TimeEntry.update).not.toHaveBeenCalled();
  });

  test('answers 404 for an unknown entry', async () => {
    const res = await call({ endTime: '2026-09-21T09:00:00Z' }, null);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('rejects a request without endTime', async () => {
    const res = await call({});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(TimeEntry.update).not.toHaveBeenCalled();
  });

  test('answers 500 when the database fails', async () => {
    TimeEntry.getById.mockRejectedValue(new Error('connection lost'));
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

  test('refuses a manual entry whose end is not after its start', async () => {
    const res = mockResponse();

    await controller.create({ body: { ...body, endTime: '2026-09-21T07:00:00Z' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TimeEntry.create).not.toHaveBeenCalled();
  });

  test('refuses invalid dates', async () => {
    const res = mockResponse();

    await controller.create({ body: { ...body, startTime: 'heute' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
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

describe('timeEntryController.delete', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('deletes a finished entry', async () => {
    TimeEntry.getById.mockResolvedValue({ id: 1, end_time: new Date() });
    TimeEntry.delete.mockResolvedValue({ id: 1 });
    const res = mockResponse();

    await controller.delete({ params: { id: '1' } }, res);

    expect(res.json).toHaveBeenCalledWith({ id: 1 });
  });

  test('refuses to delete the running entry', async () => {
    TimeEntry.getById.mockResolvedValue({ id: 1, end_time: null });
    const res = mockResponse();

    await controller.delete({ params: { id: '1' } }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(TimeEntry.delete).not.toHaveBeenCalled();
  });

  test('answers 404 for an unknown entry', async () => {
    TimeEntry.getById.mockResolvedValue(undefined);
    const res = mockResponse();

    await controller.delete({ params: { id: '1' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('timeEntryController.getByCustomerId', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('answers with the customer\'s entries', async () => {
    TimeEntry.getByCustomerId.mockResolvedValue([{ id: 1 }]);
    const res = mockResponse();

    await controller.getByCustomerId({ params: { customerId: '3' } }, res);

    expect(TimeEntry.getByCustomerId).toHaveBeenCalledWith('3');
    expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
  });

  test('answers 500 when the query fails', async () => {
    TimeEntry.getByCustomerId.mockRejectedValue(new Error('down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockResponse();

    await controller.getByCustomerId({ params: { customerId: '3' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    console.error.mockRestore();
  });
});
