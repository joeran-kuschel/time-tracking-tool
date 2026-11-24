const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));

const TimeEntry = require('../src/models/TimeEntry');
const { parseEntryFilter } = require('../src/utils/entryFilter');

let projectId;

beforeEach(async () => {
  mockPool = createTestPool();
  const customer = await mockPool.query("INSERT INTO customers (name) VALUES ('Kunde') RETURNING id");
  const project = await mockPool.query('INSERT INTO projects (customer_id, name) VALUES ($1, $2) RETURNING id', [customer.rows[0].id, 'Projekt']);
  projectId = project.rows[0].id;
});

describe('the task of an entry', () => {
  test('is stored with a new entry and is empty without one', async () => {
    const withTask = await TimeEntry.create(projectId, '2026-11-24T09:00:00Z', '2026-11-24T10:00:00Z', 'review', 'Fix login');
    const without = await TimeEntry.create(projectId, '2026-11-24T11:00:00Z', '2026-11-24T12:00:00Z', 'review');

    expect(withTask.task).toBe('Fix login');
    expect(without.task).toBeNull();
  });

  test('stays when a timer is stopped without a task', async () => {
    const running = await TimeEntry.create(projectId, '2026-11-24T09:00:00Z', null, null, 'Fix login');
    const stopped = await TimeEntry.update(running.id, { endTime: '2026-11-24T10:00:00Z' });

    expect(stopped.task).toBe('Fix login');
  });

  test('is replaced by a new one and cleared by an empty one', async () => {
    const created = await TimeEntry.create(projectId, '2026-11-24T09:00:00Z', '2026-11-24T10:00:00Z', null, 'Fix login');

    const changed = await TimeEntry.update(created.id, { endTime: '2026-11-24T10:00:00Z', task: 'Review' });
    expect(changed.task).toBe('Review');

    const cleared = await TimeEntry.update(created.id, { endTime: '2026-11-24T10:00:00Z', task: null });
    expect(cleared.task).toBeNull();
  });

  test('is found by the text search, next to the description', async () => {
    await TimeEntry.create(projectId, '2026-11-24T09:00:00Z', '2026-11-24T10:00:00Z', 'call', 'Fix login');
    await TimeEntry.create(projectId, '2026-11-24T11:00:00Z', '2026-11-24T12:00:00Z', 'fix typo', null);
    await TimeEntry.create(projectId, '2026-11-24T13:00:00Z', '2026-11-24T14:00:00Z', 'lunch', null);

    const { entries } = await TimeEntry.search(parseEntryFilter({ q: 'FIX' }).filter);

    expect(entries.map((entry) => entry.description).sort()).toEqual(['call', 'fix typo']);
  });
});

describe('TimeEntry.getTasks', () => {
  test('lists the distinct tasks of the project, the latest worked on first', async () => {
    await TimeEntry.create(projectId, '2026-11-20T09:00:00Z', '2026-11-20T10:00:00Z', null, 'Old task');
    await TimeEntry.create(projectId, '2026-11-24T09:00:00Z', '2026-11-24T10:00:00Z', null, 'Fix login');
    await TimeEntry.create(projectId, '2026-11-22T09:00:00Z', '2026-11-22T10:00:00Z', null, 'Fix login');
    await TimeEntry.create(projectId, '2026-11-23T09:00:00Z', '2026-11-23T10:00:00Z', 'no task', null);

    expect(await TimeEntry.getTasks(projectId)).toEqual(['Fix login', 'Old task']);
  });

  test('leaves out the tasks of other projects', async () => {
    const customer = await mockPool.query("INSERT INTO customers (name) VALUES ('Anderer') RETURNING id");
    const other = await mockPool.query('INSERT INTO projects (customer_id, name) VALUES ($1, $2) RETURNING id', [customer.rows[0].id, 'Anderes']);
    await TimeEntry.create(other.rows[0].id, '2026-11-24T09:00:00Z', '2026-11-24T10:00:00Z', null, 'Elsewhere');

    expect(await TimeEntry.getTasks(projectId)).toEqual([]);
  });

  test('takes at most the limit', async () => {
    await TimeEntry.create(projectId, '2026-11-23T09:00:00Z', '2026-11-23T10:00:00Z', null, 'A');
    await TimeEntry.create(projectId, '2026-11-24T09:00:00Z', '2026-11-24T10:00:00Z', null, 'B');

    expect(await TimeEntry.getTasks(projectId, 1)).toEqual(['B']);
  });
});

describe('the task in the other queries of an entry', () => {
  test('is returned by the active entry, the customer entries and the search result', async () => {
    const customerId = (await mockPool.query('SELECT customer_id FROM projects WHERE id = $1', [projectId])).rows[0].customer_id;
    await TimeEntry.create(projectId, '2026-11-24T09:00:00Z', null, null, 'Fix login');

    expect((await TimeEntry.getActive()).task).toBe('Fix login');
    expect((await TimeEntry.getByCustomerId(customerId))[0].task).toBe('Fix login');
    expect((await TimeEntry.search(parseEntryFilter({}).filter)).entries[0].task).toBe('Fix login');
  });

  test('stays when a stopped entry is resumed', async () => {
    const entry = await TimeEntry.create(projectId, '2026-11-24T09:00:00Z', '2026-11-24T10:00:00Z', null, 'Fix login');

    expect((await TimeEntry.resume(entry.id)).task).toBe('Fix login');
  });

  test('a search by text together with a project filter finds the task of that project only', async () => {
    const other = await mockPool.query('INSERT INTO projects (customer_id, name) SELECT customer_id, $1 FROM projects WHERE id = $2 RETURNING id', ['Anderes', projectId]);
    await TimeEntry.create(projectId, '2026-11-24T09:00:00Z', '2026-11-24T10:00:00Z', null, 'Fix login');
    await TimeEntry.create(other.rows[0].id, '2026-11-24T11:00:00Z', '2026-11-24T12:00:00Z', null, 'Fix login');

    const { entries, total } = await TimeEntry.search(parseEntryFilter({ q: 'login', projectId: String(projectId) }).filter);

    expect(total).toBe(1);
    expect(entries.map((entry) => entry.project_id)).toEqual([projectId]);
  });

  test('the text search does not find an entry that has neither the text in its task nor its description', async () => {
    await TimeEntry.create(projectId, '2026-11-24T09:00:00Z', '2026-11-24T10:00:00Z', 'call', 'Review');

    expect((await TimeEntry.search(parseEntryFilter({ q: 'login' }).filter)).entries).toEqual([]);
  });

  test('a task with % or _ is searched literally', async () => {
    await TimeEntry.create(projectId, '2026-11-24T09:00:00Z', '2026-11-24T10:00:00Z', null, '100% done');
    await TimeEntry.create(projectId, '2026-11-24T11:00:00Z', '2026-11-24T12:00:00Z', null, 'other');

    expect((await TimeEntry.search(parseEntryFilter({ q: '%' }).filter)).entries).toHaveLength(1);
  });
});

describe('TimeEntry.getTasks, a task in several spellings', () => {
  test('lists it once, in the spelling of the latest entry', async () => {
    await TimeEntry.create(projectId, '2026-11-22T09:00:00Z', '2026-11-22T10:00:00Z', null, 'Fix login');
    await TimeEntry.create(projectId, '2026-11-24T09:00:00Z', '2026-11-24T10:00:00Z', null, 'fix LOGIN ');
    await TimeEntry.create(projectId, '2026-11-23T09:00:00Z', '2026-11-23T10:00:00Z', null, 'Review');

    expect(await TimeEntry.getTasks(projectId)).toEqual(['fix LOGIN ', 'Review']);
  });
});
