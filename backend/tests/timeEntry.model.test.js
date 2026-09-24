const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));

const TimeEntry = require('../src/models/TimeEntry');

async function createProject() {
  const customer = await mockPool.query("INSERT INTO customers (name) VALUES ('Kunde') RETURNING id");
  const project = await mockPool.query(
    'INSERT INTO projects (customer_id, name) VALUES ($1, $2) RETURNING id',
    [customer.rows[0].id, 'Projekt']
  );
  return project.rows[0].id;
}

describe('TimeEntry.update', () => {
  let entry;

  beforeEach(async () => {
    mockPool = createTestPool();
    const projectId = await createProject();
    entry = await TimeEntry.create(projectId, '2026-09-21T08:00:00Z', null, 'Konzept schreiben');
  });

  test('keeps the description when none is given (stopping the timer)', async () => {
    const updated = await TimeEntry.update(entry.id, { endTime: '2026-09-21T09:00:00Z' });
    expect(updated.description).toBe('Konzept schreiben');
    expect(updated.end_time).not.toBeNull();
  });

  test('replaces the description when a new one is given', async () => {
    const updated = await TimeEntry.update(entry.id, { endTime: '2026-09-21T09:00:00Z', description: 'Konzept überarbeiten' });
    expect(updated.description).toBe('Konzept überarbeiten');
  });

  test('clears the description when an empty string is given', async () => {
    const updated = await TimeEntry.update(entry.id, { endTime: '2026-09-21T09:00:00Z', description: '' });
    expect(updated.description).toBeNull();
  });

  test('changes start time and project when given, and keeps them otherwise', async () => {
    const other = await mockPool.query(
      'INSERT INTO projects (customer_id, name) SELECT customer_id, $1 FROM projects WHERE id = $2 RETURNING id',
      ['Anderes Projekt', entry.project_id]
    );
    const moved = await TimeEntry.update(entry.id, {
      startTime: '2026-09-21T07:30:00Z', endTime: '2026-09-21T09:00:00Z', projectId: other.rows[0].id,
    });
    expect(new Date(moved.start_time).toISOString()).toBe('2026-09-21T07:30:00.000Z');
    expect(moved.project_id).toBe(other.rows[0].id);

    const kept = await TimeEntry.update(entry.id, { endTime: '2026-09-21T09:15:00Z' });
    expect(new Date(kept.start_time).toISOString()).toBe('2026-09-21T07:30:00.000Z');
    expect(kept.project_id).toBe(other.rows[0].id);
  });

  test('clears the description when null is given', async () => {
    const updated = await TimeEntry.update(entry.id, { endTime: '2026-09-21T09:00:00Z', description: null });
    expect(updated.description).toBeNull();
  });
});

describe('TimeEntry.getActive', () => {
  let projectId;

  beforeEach(async () => {
    mockPool = createTestPool();
    projectId = await createProject();
  });

  test('returns undefined when no timer is running', async () => {
    await TimeEntry.create(projectId, '2026-09-21T08:00:00Z', '2026-09-21T09:00:00Z', null);
    expect(await TimeEntry.getActive()).toBeUndefined();
  });

  test('returns the running entry with its project and customer', async () => {
    await TimeEntry.create(projectId, '2026-09-21T08:00:00Z', '2026-09-21T09:00:00Z', null);
    const running = await TimeEntry.create(projectId, '2026-09-21T10:00:00Z', null, 'Konzept');

    const active = await TimeEntry.getActive();

    expect(active.id).toBe(running.id);
    expect(active.project_name).toBe('Projekt');
    expect(active.customer_name).toBe('Kunde');
  });
});

describe('TimeEntry.getByCustomerId', () => {
  beforeEach(() => {
    mockPool = createTestPool();
  });

  test('returns only the customer\'s entries, grouped by project name and newest first', async () => {
    const [kunde, andere] = await Promise.all(['Kunde', 'Andere'].map(async (name) =>
      (await mockPool.query('INSERT INTO customers (name) VALUES ($1) RETURNING id', [name])).rows[0].id));
    const addProject = async (customerId, name) =>
      (await mockPool.query('INSERT INTO projects (customer_id, name) VALUES ($1, $2) RETURNING id', [customerId, name])).rows[0].id;
    const website = await addProject(kunde, 'Website');
    const app = await addProject(kunde, 'App');
    const fremd = await addProject(andere, 'Fremd');
    const early = await TimeEntry.create(website, '2026-09-20T08:00:00Z', '2026-09-20T09:00:00Z', null);
    const late = await TimeEntry.create(website, '2026-09-21T08:00:00Z', '2026-09-21T09:00:00Z', null);
    const appEntry = await TimeEntry.create(app, '2026-09-19T08:00:00Z', null, null);
    await TimeEntry.create(fremd, '2026-09-21T08:00:00Z', '2026-09-21T09:00:00Z', null);

    const entries = await TimeEntry.getByCustomerId(kunde);

    expect(entries.map((e) => e.id)).toEqual([appEntry.id, late.id, early.id]);
    expect(entries.map((e) => e.project_name)).toEqual(['App', 'Website', 'Website']);
  });
});

describe('TimeEntry.getInRange and getRecent', () => {
  let projectId;

  beforeEach(async () => {
    mockPool = createTestPool();
    projectId = await createProject();
  });

  test('returns the entries of all customers that start in the range, with project, rate and customer', async () => {
    await TimeEntry.create(projectId, '2026-08-31T23:00:00Z', '2026-09-01T00:30:00Z', 'vorher');
    await TimeEntry.create(projectId, '2026-09-02T08:00:00Z', '2026-09-02T09:00:00Z', 'zweiter');
    await TimeEntry.create(projectId, '2026-09-01T08:00:00Z', null, 'läuft');
    await TimeEntry.create(projectId, '2026-10-01T00:00:00Z', '2026-10-01T01:00:00Z', 'danach');

    const entries = await TimeEntry.getInRange('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z');

    expect(entries.map((e) => e.description)).toEqual(['läuft', 'zweiter']);
    expect(entries[0]).toMatchObject({ project_name: 'Projekt', customer_name: 'Kunde' });
    expect(entries[0]).toHaveProperty('hourly_rate');
  });

  test('returns the latest finished entries, newest first, up to the limit', async () => {
    for (let day = 1; day <= 4; day++) {
      await TimeEntry.create(projectId, `2026-09-0${day}T08:00:00Z`, `2026-09-0${day}T09:00:00Z`, `Tag ${day}`);
    }
    await TimeEntry.create(projectId, '2026-09-05T08:00:00Z', null, 'läuft');

    const recent = await TimeEntry.getRecent(3);

    expect(recent.map((e) => e.description)).toEqual(['Tag 4', 'Tag 3', 'Tag 2']);
    expect(recent[0].customer_name).toBe('Kunde');
  });
});

describe('TimeEntry.getByCustomerIdInRange', () => {
  let projectId;

  beforeEach(async () => {
    mockPool = createTestPool();
    projectId = await createProject();
  });

  test('returns the customer\'s entries that start in [from, to), up to the last millisecond', async () => {
    // October in Berlin: 2026-09-30T22:00Z to 2026-10-31T23:00Z
    await TimeEntry.create(projectId, '2026-09-30T21:59:59Z', '2026-09-30T23:00:00Z', 'September');
    await TimeEntry.create(projectId, '2026-09-30T22:30:00Z', '2026-09-30T23:30:00Z', '00:30 am 1. Oktober');
    await TimeEntry.create(projectId, '2026-10-31T22:59:59.500Z', '2026-10-31T23:30:00Z', 'letzte Sekunde');
    await TimeEntry.create(projectId, '2026-10-31T23:00:00Z', '2026-10-31T23:30:00Z', 'November');

    const entries = await TimeEntry.getByCustomerIdInRange(1, { from: '2026-09-30T22:00:00.000Z', to: '2026-10-31T23:00:00.000Z' });

    expect(entries.map((e) => e.description)).toEqual(['letzte Sekunde', '00:30 am 1. Oktober']);
    expect(entries[0]).toMatchObject({ project_name: 'Projekt', customer_name: 'Kunde' });
  });
});

describe('the one_running_timer index', () => {
  let projectId;

  beforeEach(async () => {
    mockPool = createTestPool();
    projectId = await createProject();
  });

  test('refuses a second running entry, even without the controller\'s check', async () => {
    await TimeEntry.create(projectId, '2026-09-21T08:00:00Z', null, 'läuft');

    await expect(TimeEntry.create(projectId, '2026-09-21T08:00:01Z', null, 'doppelt')).rejects.toMatchObject({ code: '23505' });
  });

  test('allows any number of finished entries, and a new timer once the old one is stopped', async () => {
    const running = await TimeEntry.create(projectId, '2026-09-21T08:00:00Z', null, 'läuft');
    await TimeEntry.create(projectId, '2026-09-20T08:00:00Z', '2026-09-20T09:00:00Z', 'fertig 1');
    await TimeEntry.create(projectId, '2026-09-19T08:00:00Z', '2026-09-19T09:00:00Z', 'fertig 2');

    await TimeEntry.update(running.id, { endTime: '2026-09-21T09:00:00Z' });

    await expect(TimeEntry.create(projectId, '2026-09-21T10:00:00Z', null, 'neu')).resolves.toMatchObject({ description: 'neu' });
  });
});
