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
