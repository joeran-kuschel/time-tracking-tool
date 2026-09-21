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
    const updated = await TimeEntry.update(entry.id, '2026-09-21T09:00:00Z');
    expect(updated.description).toBe('Konzept schreiben');
    expect(updated.end_time).not.toBeNull();
  });

  test('replaces the description when a new one is given', async () => {
    const updated = await TimeEntry.update(entry.id, '2026-09-21T09:00:00Z', 'Konzept überarbeiten');
    expect(updated.description).toBe('Konzept überarbeiten');
  });

  test('clears the description when an empty string is given', async () => {
    const updated = await TimeEntry.update(entry.id, '2026-09-21T09:00:00Z', '');
    expect(updated.description).toBeNull();
  });

  test('clears the description when null is given', async () => {
    const updated = await TimeEntry.update(entry.id, '2026-09-21T09:00:00Z', null);
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
