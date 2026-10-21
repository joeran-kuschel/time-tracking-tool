jest.mock('../src/models/TimeEntry');

const TimeEntry = require('../src/models/TimeEntry');
const controller = require('../src/controllers/timeEntryController');

function mockResponse() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('timeEntryController.search', () => {
  const found = { entries: [{ id: 1 }], total: 1, hours: 1.5 };
  const call = async (query = {}) => {
    const res = mockResponse();
    await controller.search({ query }, res);
    return res;
  };

  beforeEach(() => {
    jest.resetAllMocks();
    TimeEntry.search.mockResolvedValue(found);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test('searches with the defaults and answers entries, total, hours, limit and offset', async () => {
    const res = await call();

    expect(TimeEntry.search).toHaveBeenCalledWith(expect.objectContaining({ sort: 'newest' }), { limit: 50, offset: 0 });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ...found, limit: 50, offset: 0 });
  });

  test('passes the parsed filter, limit and offset to the model', async () => {
    const res = await call({ q: ' Konzept ', customerId: '2', projectId: '5', from: '2026-09-01', to: '2026-09-30', tz: 'UTC', sort: 'oldest', limit: '10', offset: '20' });

    expect(TimeEntry.search).toHaveBeenCalledWith(
      { q: 'Konzept', customerId: 2, projectId: 5, from: '2026-09-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z', sort: 'oldest' },
      { limit: 10, offset: 20 }
    );
    expect(res.json).toHaveBeenCalledWith({ ...found, limit: 10, offset: 20 });
  });

  test.each([
    [{ customerId: 'x' }], [{ projectId: '0' }], [{ from: '2026-02-30' }], [{ to: 'x' }],
    [{ from: '2026-09-02', to: '2026-09-01' }], [{ sort: 'id' }], [{ q: 'a'.repeat(201) }],
    [{ limit: '0' }], [{ limit: '201' }], [{ limit: '1.5' }], [{ limit: 'abc' }], [{ limit: ['1', '2'] }],
    [{ offset: '-1' }], [{ offset: '1.5' }], [{ offset: 'abc' }],
  ])('answers 400 for %j without querying', async (query) => {
    const res = await call(query);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.any(String) });
    expect(TimeEntry.search).not.toHaveBeenCalled();
  });

  test('accepts the limits 1 and 200', async () => {
    await call({ limit: '1' });
    await call({ limit: '200' });

    expect(TimeEntry.search).toHaveBeenCalledTimes(2);
  });

  test('uses the defaults for empty limit and offset', async () => {
    await call({ limit: '', offset: '' });

    expect(TimeEntry.search).toHaveBeenCalledWith(expect.anything(), { limit: 50, offset: 0 });
  });

  test('accepts an offset of 0 and a large offset', async () => {
    await call({ offset: '0' });
    await call({ offset: '100000' });

    expect(TimeEntry.search).toHaveBeenLastCalledWith(expect.anything(), { limit: 50, offset: 100000 });
  });

  test.each([[{ offset: ['1', '2'] }], [{ offset: '1e3' }], [{ limit: ' 5' }], [{ limit: '+5' }]])(
    'answers 400 for the repeated or malformed paging %j',
    async (query) => {
      const res = await call(query);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(TimeEntry.search).not.toHaveBeenCalled();
    }
  );

  test('treats a search text of only spaces as no text', async () => {
    await call({ q: '   ' });

    expect(TimeEntry.search.mock.calls[0][0].q).toBeUndefined();
  });

  test('answers 500 when the model fails', async () => {
    TimeEntry.search.mockRejectedValue(new Error('db down'));

    const res = await call();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to search time entries' });
  });
});
