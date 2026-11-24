jest.mock('../src/models/TimeEntry');
jest.mock('../src/models/Project');
jest.mock('../src/models/Settings');

const TimeEntry = require('../src/models/TimeEntry');
const controller = require('../src/controllers/timeEntryController');
const router = require('../src/routes/timeEntries');

function mockResponse() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe('the task in timeEntryController.create', () => {
  const body = { projectId: 3, startTime: '2026-11-24T08:00:00Z', endTime: '2026-11-24T09:00:00Z', description: 'review' };

  test('passes the trimmed task on', async () => {
    TimeEntry.create.mockResolvedValue({ id: 1 });

    await controller.create({ body: { ...body, task: '  Fix login ' } }, mockResponse());

    expect(TimeEntry.create).toHaveBeenCalledWith(3, '2026-11-24T08:00:00.000Z', '2026-11-24T09:00:00.000Z', 'review', 'Fix login');
  });

  test('refuses a task that is not text or too long with 400 and creates nothing', async () => {
    for (const task of [5, 'a'.repeat(101)]) {
      const res = mockResponse();
      await controller.create({ body: { ...body, task } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(TimeEntry.create).not.toHaveBeenCalled();
  });
});

describe('the task in timeEntryController.update', () => {
  const entry = { id: 1, project_id: 3, start_time: new Date('2026-11-24T08:00:00Z'), end_time: new Date('2026-11-24T09:00:00Z') };
  const call = async (task) => {
    TimeEntry.getById.mockResolvedValue(entry);
    TimeEntry.update.mockResolvedValue({ id: 1 });
    const res = mockResponse();
    await controller.update({ params: { id: '1' }, body: { endTime: '2026-11-24T09:00:00Z', task } }, res);
    return res;
  };

  test('changes the task, clears it with an empty text and keeps it when it is not sent', async () => {
    await call('Review');
    expect(TimeEntry.update).toHaveBeenLastCalledWith('1', expect.objectContaining({ task: 'Review' }));

    await call('');
    expect(TimeEntry.update).toHaveBeenLastCalledWith('1', expect.objectContaining({ task: null }));

    await call(undefined);
    expect(TimeEntry.update.mock.calls.at(-1)[1].task).toBeUndefined();
  });

  test('refuses a bad task with 400 and changes nothing', async () => {
    const res = await call(['x']);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TimeEntry.update).not.toHaveBeenCalled();
  });
});

describe('timeEntryController.getTasks', () => {
  test('answers the tasks of the project', async () => {
    TimeEntry.getTasks.mockResolvedValue(['Fix login']);
    const res = mockResponse();

    await controller.getTasks({ params: { projectId: '3' } }, res);

    expect(TimeEntry.getTasks).toHaveBeenCalledWith(3);
    expect(res.json).toHaveBeenCalledWith(['Fix login']);
  });

  test('answers 400 for an id that is not a record id, without asking the database', async () => {
    const res = mockResponse();

    await controller.getTasks({ params: { projectId: 'abc' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TimeEntry.getTasks).not.toHaveBeenCalled();
  });

  test('answers 500 when the database fails', async () => {
    TimeEntry.getTasks.mockRejectedValue(new Error('down'));
    const res = mockResponse();

    await controller.getTasks({ params: { projectId: '3' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

test('the tasks route is matched before /:id', () => {
  const getPaths = router.stack.filter((layer) => layer.route?.methods.get).map((layer) => layer.route.path);

  expect(getPaths.indexOf('/tasks/:projectId')).toBeGreaterThanOrEqual(0);
  expect(getPaths.indexOf('/tasks/:projectId')).toBeLessThan(getPaths.indexOf('/:id'));
});
