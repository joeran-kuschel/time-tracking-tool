const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));

const TimeEntry = require('../src/models/TimeEntry');

let projectId;
const finished = (start, end, description, task) => TimeEntry.create(projectId, start, end, description, task);

beforeEach(async () => {
  mockPool = createTestPool();
  const customer = await mockPool.query("INSERT INTO customers (name) VALUES ('Kunde') RETURNING id");
  const project = await mockPool.query('INSERT INTO projects (customer_id, name) VALUES ($1, $2) RETURNING id', [customer.rows[0].id, 'Projekt']);
  projectId = project.rows[0].id;
});

describe('TimeEntry.setTask', () => {
  test('sets the task of the given entries and changes nothing else', async () => {
    const a = await finished('2026-11-23T09:00:00Z', '2026-11-23T10:00:00Z', 'review', null);
    const b = await finished('2026-11-24T09:00:00Z', '2026-11-24T09:30:00Z', 'call', 'Old');
    const other = await finished('2026-11-24T11:00:00Z', '2026-11-24T12:00:00Z', 'untouched', null);

    expect(await TimeEntry.setTask([a.id, b.id], 'Fix login')).toBe(2);

    const after = async (entry) => TimeEntry.getById(entry.id);
    expect(await after(a)).toMatchObject({ task: 'Fix login', description: 'review', start_time: a.start_time, end_time: a.end_time, project_id: projectId });
    expect(await after(b)).toMatchObject({ task: 'Fix login', description: 'call' });
    expect((await after(other)).task).toBeNull();
  });

  test('clears the task for an empty text and for null', async () => {
    const a = await finished('2026-11-23T09:00:00Z', '2026-11-23T10:00:00Z', null, 'Fix login');
    const b = await finished('2026-11-24T09:00:00Z', '2026-11-24T10:00:00Z', null, 'Fix login');

    await TimeEntry.setTask([a.id], '');
    await TimeEntry.setTask([b.id], null);

    expect((await TimeEntry.getById(a.id)).task).toBeNull();
    expect((await TimeEntry.getById(b.id)).task).toBeNull();
  });

  test('leaves the running entry alone, even when its id is given', async () => {
    const running = await finished('2026-11-24T09:00:00Z', null, null, null);
    const done = await finished('2026-11-23T09:00:00Z', '2026-11-23T10:00:00Z', null, null);

    expect(await TimeEntry.setTask([running.id, done.id], 'Fix login')).toBe(1);
    expect((await TimeEntry.getById(running.id)).task).toBeNull();
  });

  test('sets the task across projects and customers in one call', async () => {
    const otherCustomer = await mockPool.query("INSERT INTO customers (name) VALUES ('Zweiter') RETURNING id");
    const otherProject = await mockPool.query('INSERT INTO projects (customer_id, name) VALUES ($1, $2) RETURNING id', [otherCustomer.rows[0].id, 'Anderes']);
    const a = await finished('2026-11-23T09:00:00Z', '2026-11-23T10:00:00Z', null, null);
    const b = await TimeEntry.create(otherProject.rows[0].id, '2026-11-24T09:00:00Z', '2026-11-24T10:00:00Z', null, null);

    expect(await TimeEntry.setTask([a.id, b.id], 'Shared')).toBe(2);

    expect((await TimeEntry.getById(a.id)).project_id).toBe(projectId);
    expect(await TimeEntry.getById(b.id)).toMatchObject({ task: 'Shared', project_id: otherProject.rows[0].id });
  });

  test('shows up in the task list of the project afterwards', async () => {
    const a = await finished('2026-11-23T09:00:00Z', '2026-11-23T10:00:00Z', null, null);

    await TimeEntry.setTask([a.id], 'Fix login');

    expect(await TimeEntry.getTasks(projectId)).toEqual(['Fix login']);
  });

  test('counts only the known ids and changes none for unknown ones', async () => {
    const a = await finished('2026-11-23T09:00:00Z', '2026-11-23T10:00:00Z', null, null);

    expect(await TimeEntry.setTask([a.id, 99999], 'A')).toBe(1);
    expect(await TimeEntry.setTask([99999], 'A')).toBe(0);
  });

  test('moves updated_at', async () => {
    const a = await finished('2026-11-23T09:00:00Z', '2026-11-23T10:00:00Z', null, null);
    await mockPool.query("UPDATE time_entries SET updated_at = '2020-01-01' WHERE id = $1", [a.id]);

    await TimeEntry.setTask([a.id], 'Fix login');

    expect(new Date((await TimeEntry.getById(a.id)).updated_at).getFullYear()).toBeGreaterThan(2020);
  });

  test('takes a long list of ids', async () => {
    const entries = [];
    for (let day = 1; day <= 30; day++) {
      entries.push(await finished(`2026-10-${String(day).padStart(2, '0')}T09:00:00Z`, `2026-10-${String(day).padStart(2, '0')}T10:00:00Z`, null, null));
    }

    expect(await TimeEntry.setTask(entries.map((entry) => entry.id), 'Many')).toBe(30);
  });
});

describe('TimeEntry.getStates', () => {
  test('answers the id and end of each known entry, and leaves out unknown ids', async () => {
    const running = await finished('2026-11-24T09:00:00Z', null, null, null);
    const done = await finished('2026-11-23T09:00:00Z', '2026-11-23T10:00:00Z', null, null);

    const states = await TimeEntry.getStates([running.id, done.id, 99999]);

    expect(states.map((state) => state.id).sort()).toEqual([running.id, done.id].sort());
    expect(states.find((state) => state.id === running.id).end_time).toBeNull();
  });
});
