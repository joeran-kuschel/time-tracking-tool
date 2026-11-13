jest.mock('../src/models/TimeEntry');
jest.mock('../src/models/Project');
jest.mock('../src/models/Settings');

const TimeEntry = require('../src/models/TimeEntry');
const Project = require('../src/models/Project');
const Settings = require('../src/models/Settings');
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

    expect(TimeEntry.update).toHaveBeenCalledWith('1', { endTime: '2026-09-21T09:00:00.000Z', startTime: undefined, projectId: undefined, description: undefined });
    expect(res.json).toHaveBeenCalledWith({ id: 1 });
  });

  describe('stopping with an end that is not after the start', () => {
    const NOW = new Date('2026-09-21T10:00:00Z');
    const storedEnd = () => TimeEntry.update.mock.calls[0][1].endTime;

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(NOW);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('stores exactly the sent end when it is after the start', async () => {
      await call({ endTime: '2026-09-21T09:00:00Z' }, running);
      expect(storedEnd()).toBe('2026-09-21T09:00:00.000Z');
    });

    test('stores the server time when the sent end is before the start', async () => {
      const res = await call({ endTime: '2026-09-21T07:59:58Z' }, running);

      expect(storedEnd()).toBe(NOW.toISOString());
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ id: 1 });
    });

    test('stores the server time when the sent end equals the start', async () => {
      await call({ endTime: '2026-09-21T08:00:00Z' }, running);
      expect(storedEnd()).toBe(NOW.toISOString());
    });

    test('stores end = start when even the server time is not after the start', async () => {
      const future = { ...running, start_time: new Date('2026-09-21T12:00:00Z') };
      const res = await call({ endTime: '2026-09-21T09:00:00Z' }, future);

      expect(storedEnd()).toBe(future.start_time.toISOString());
      expect(res.status).not.toHaveBeenCalled();
    });

    test('compares by the millisecond: 1 ms after the start is kept, 1 ms before is replaced', async () => {
      await call({ endTime: '2026-09-21T08:00:00.001Z' }, running);
      expect(storedEnd()).toBe('2026-09-21T08:00:00.001Z');

      TimeEntry.update.mockClear();
      await call({ endTime: '2026-09-21T07:59:59.999Z' }, running);
      expect(storedEnd()).toBe(NOW.toISOString());
    });

    test('reads a start that is an ISO string like a Date', async () => {
      await call({ endTime: '2026-09-21T07:00:00Z' }, { ...running, start_time: '2026-09-21T08:00:00.000Z' });
      expect(storedEnd()).toBe(NOW.toISOString());
    });

    test('compares end times with an offset by the instant they mean', async () => {
      await call({ endTime: '2026-09-21T09:30:00+02:00' }, running);
      expect(storedEnd()).toBe(NOW.toISOString());
    });

    test('stores a sent end with an offset as the UTC instant it means', async () => {
      await call({ endTime: '2026-09-21T07:30:00-02:00' }, running);
      expect(storedEnd()).toBe('2026-09-21T09:30:00.000Z');
    });

    test('still refuses an invalid date', async () => {
      expect((await call({ endTime: 'tomorrow' }, running)).status).toHaveBeenCalledWith(400);
      expect(TimeEntry.update).not.toHaveBeenCalled();
    });

    test('does not change the end of a finished entry', async () => {
      await call({ endTime: '2026-09-21T09:30:00Z' });
      expect(storedEnd()).toBe('2026-09-21T09:30:00.000Z');
    });
  });

  test('refuses to edit the times or project of a running entry', async () => {
    expect((await call({ endTime: '2026-09-21T09:00:00Z', startTime: '2026-09-21T07:00:00Z' }, running)).status).toHaveBeenCalledWith(409);
    expect((await call({ endTime: '2026-09-21T09:00:00Z', projectId: 4 }, running)).status).toHaveBeenCalledWith(409);
    expect(TimeEntry.update).not.toHaveBeenCalled();
  });

  test('edits start, end and description of a finished entry', async () => {
    const body = { startTime: '2026-09-21T07:30:00Z', endTime: '2026-09-21T10:00:00Z', description: 'Neu' };
    const res = await call(body);

    expect(TimeEntry.update).toHaveBeenCalledWith('1', { startTime: '2026-09-21T07:30:00.000Z', endTime: '2026-09-21T10:00:00.000Z', description: 'Neu', projectId: undefined });
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

    expect(TimeEntry.create).toHaveBeenCalledWith(3, '2026-09-21T08:00:00.000Z', null, 'Konzept');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('refuses a second running timer with 409', async () => {
    TimeEntry.getActive.mockResolvedValue({ id: 9 });
    const res = mockResponse();

    await controller.create({ body }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(TimeEntry.create).not.toHaveBeenCalled();
  });

  test('answers 409 when another start wins the race and the database refuses the second timer', async () => {
    TimeEntry.getActive.mockResolvedValue(undefined);
    TimeEntry.create.mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505' }));
    const res = mockResponse();

    await controller.create({ body }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'A timer is already running' });
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

  beforeEach(() => {
    Settings.get.mockResolvedValue({ showAmounts: false, roundingMinutes: 0, roundingDirection: 'up', showRoundingNote: false });
  });

  test('answers with the customer\'s entries', async () => {
    TimeEntry.getByCustomerId.mockResolvedValue([{ id: 1 }]);
    const res = mockResponse();

    await controller.getByCustomerId({ params: { customerId: '3' } }, res);

    expect(TimeEntry.getByCustomerId).toHaveBeenCalledWith('3');
    expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
  });

  describe('with a rounding rule', () => {
    const entry = (id, minutes, rate = '80.00') => ({
      id, project_id: 7, project_name: 'Web', hourly_rate: rate,
      start_time: '2026-09-21T08:00:00Z', end_time: new Date(Date.UTC(2026, 8, 21, 8, minutes)).toISOString(),
    });

    beforeEach(() => {
      Settings.get.mockResolvedValue({ showAmounts: false, roundingMinutes: 15, roundingDirection: 'up', showRoundingNote: false });
    });

    test('adds billed_hours and billed_amount to each entry and keeps the entries exact', async () => {
      TimeEntry.getByCustomerId.mockResolvedValue([entry(1, 65), entry(2, 20)]);
      const res = mockResponse();

      await controller.getByCustomerId({ params: { customerId: '3' } }, res);

      const body = res.json.mock.calls[0][0];
      expect(body.map((e) => [e.billed_hours, e.billed_amount])).toEqual([['1.25', '100.00'], ['0.50', '40.00']]);
      expect(body.every((e) => e.billed_rule.minutes === 15 && e.billed_rule.direction === 'up')).toBe(true);
      expect(body[0].end_time).toBe(entry(1, 65).end_time);
    });

    test('a running entry and one that ends before it starts have neither', async () => {
      const running = { ...entry(3, 10), end_time: null };
      const backwards = { ...entry(4, 10), start_time: '2026-09-21T12:00:00Z', end_time: '2026-09-21T11:00:00Z' };
      TimeEntry.getByCustomerId.mockResolvedValue([running, backwards]);
      const res = mockResponse();

      await controller.getByCustomerId({ params: { customerId: '3' } }, res);

      expect(res.json.mock.calls[0][0].map((e) => [e.billed_hours, e.billed_amount])).toEqual([[null, null], [null, null]]);
    });

    test('the customer\'s own rule wins over the global one, and no rounding for the customer keeps the hours exact', async () => {
      const own = (minutes, direction) => ({ customer_rounding_minutes: minutes, customer_rounding_direction: direction });
      TimeEntry.getByCustomerId.mockResolvedValueOnce([{ ...entry(1, 65), ...own(60, 'up') }]).mockResolvedValueOnce([{ ...entry(2, 65), ...own(0, 'up') }]);
      const a = mockResponse();
      const b = mockResponse();

      await controller.getByCustomerId({ params: { customerId: '3' } }, a);
      await controller.getByCustomerId({ params: { customerId: '3' } }, b);

      expect(a.json.mock.calls[0][0][0]).toMatchObject({ billed_hours: '2.00', billed_amount: '160.00', billed_rule: { minutes: 60, direction: 'up' } });
      expect(b.json.mock.calls[0][0][0]).toMatchObject({ billed_hours: null, billed_amount: null, billed_rule: null });
    });

    test('a running entry of a customer with an own rule carries the rule but no billed values', async () => {
      TimeEntry.getByCustomerId.mockResolvedValue([{ ...entry(5, 10), end_time: null, customer_rounding_minutes: 30, customer_rounding_direction: 'up' }]);
      const res = mockResponse();

      await controller.getByCustomerId({ params: { customerId: '3' } }, res);

      expect(res.json.mock.calls[0][0][0]).toMatchObject({ billed_hours: null, billed_amount: null, billed_rule: { minutes: 30, direction: 'up' } });
    });

    test('reads the settings once', async () => {
      TimeEntry.getByCustomerId.mockResolvedValue([entry(1, 65)]);

      await controller.getByCustomerId({ params: { customerId: '3' } }, mockResponse());

      expect(Settings.get).toHaveBeenCalledTimes(1);
    });
  });

  test('answers 500 when the settings can not be read', async () => {
    TimeEntry.getByCustomerId.mockResolvedValue([{ id: 1 }]);
    Settings.get.mockRejectedValue(new Error('down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockResponse();

    await controller.getByCustomerId({ params: { customerId: '3' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    console.error.mockRestore();
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
