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

const finishedState = (id) => ({ id, end_time: new Date('2026-11-24T10:00:00Z') });
const call = async (body) => {
  const res = mockResponse();
  await controller.setTask({ body }, res);
  return res;
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe('timeEntryController.setTask', () => {
  test('sets the trimmed task and answers the number of changed entries', async () => {
    TimeEntry.getStates.mockResolvedValue([finishedState(1), finishedState(2)]);
    TimeEntry.setTask.mockResolvedValue(2);

    const res = await call({ ids: [1, 2], task: '  Fix login ' });

    expect(TimeEntry.setTask).toHaveBeenCalledWith([1, 2], 'Fix login');
    expect(res.json).toHaveBeenCalledWith({ updated: 2 });
  });

  test('clears the task for an empty text or null', async () => {
    TimeEntry.getStates.mockResolvedValue([finishedState(1)]);
    TimeEntry.setTask.mockResolvedValue(1);

    await call({ ids: [1], task: '' });
    await call({ ids: [1], task: null });

    expect(TimeEntry.setTask).toHaveBeenNthCalledWith(1, [1], null);
    expect(TimeEntry.setTask).toHaveBeenNthCalledWith(2, [1], null);
  });

  test('counts an id once', async () => {
    TimeEntry.getStates.mockResolvedValue([finishedState(1)]);
    TimeEntry.setTask.mockResolvedValue(1);

    await call({ ids: [1, 1], task: 'A' });

    expect(TimeEntry.setTask).toHaveBeenCalledWith([1], 'A');
  });

  test.each([
    ['no body', undefined],
    ['no ids', { task: 'A' }],
    ['ids that are not a list', { ids: 1, task: 'A' }],
    ['an empty list', { ids: [], task: 'A' }],
    ['an id that is not a number', { ids: ['1'], task: 'A' }],
    ['an id below 1', { ids: [0], task: 'A' }],
    ['an id that is not whole', { ids: [1.5], task: 'A' }],
    ['an id above the column', { ids: [2147483648], task: 'A' }],
    ['more than 1000 ids', { ids: Array.from({ length: 1001 }, (_, index) => index + 1), task: 'A' }],
    ['no task', { ids: [1] }],
    ['a task that is not text', { ids: [1], task: 5 }],
    ['a task that is too long', { ids: [1], task: 'a'.repeat(101) }],
  ])('answers 400 for %s and asks the database nothing', async (name, body) => {
    const res = await call(body);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TimeEntry.getStates).not.toHaveBeenCalled();
    expect(TimeEntry.setTask).not.toHaveBeenCalled();
  });

  test('takes 1000 ids', async () => {
    const ids = Array.from({ length: 1000 }, (_, index) => index + 1);
    TimeEntry.getStates.mockResolvedValue(ids.map(finishedState));
    TimeEntry.setTask.mockResolvedValue(1000);

    const res = await call({ ids, task: 'A' });

    expect(res.json).toHaveBeenCalledWith({ updated: 1000 });
  });

  test('answers 404 when an entry is unknown, and changes nothing', async () => {
    TimeEntry.getStates.mockResolvedValue([finishedState(1)]);

    const res = await call({ ids: [1, 2], task: 'A' });

    expect(res.status).toHaveBeenCalledWith(404);
    expect(TimeEntry.setTask).not.toHaveBeenCalled();
  });

  test('answers 409 when an entry is the running timer, and changes nothing', async () => {
    TimeEntry.getStates.mockResolvedValue([finishedState(1), { id: 2, end_time: null }]);

    const res = await call({ ids: [1, 2], task: 'A' });

    expect(res.status).toHaveBeenCalledWith(409);
    expect(TimeEntry.setTask).not.toHaveBeenCalled();
  });

  test('answers the number really changed when a timer started after the check', async () => {
    TimeEntry.getStates.mockResolvedValue([finishedState(1), finishedState(2)]);
    TimeEntry.setTask.mockResolvedValue(1);

    const res = await call({ ids: [1, 2], task: 'A' });

    expect(res.json).toHaveBeenCalledWith({ updated: 1 });
  });

  test('answers 500 when the update fails after the check', async () => {
    TimeEntry.getStates.mockResolvedValue([finishedState(1)]);
    TimeEntry.setTask.mockRejectedValue(new Error('down'));

    expect((await call({ ids: [1], task: 'A' })).status).toHaveBeenCalledWith(500);
  });

  test('answers 400 for a body that is null', async () => {
    expect((await call(null)).status).toHaveBeenCalledWith(400);
  });

  test('answers 500 when the database fails', async () => {
    TimeEntry.getStates.mockRejectedValue(new Error('down'));

    expect((await call({ ids: [1], task: 'A' })).status).toHaveBeenCalledWith(500);
  });
});

test('PATCH /task is matched before PATCH /:id', () => {
  const patchPaths = router.stack.filter((layer) => layer.route?.methods.patch).map((layer) => layer.route.path);

  expect(patchPaths.indexOf('/task')).toBeGreaterThanOrEqual(0);
  expect(patchPaths.indexOf('/task')).toBeLessThan(patchPaths.indexOf('/:id'));
});
