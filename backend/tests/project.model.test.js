const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));

const Project = require('../src/models/Project');

describe('Project.update', () => {
  let project;

  beforeEach(async () => {
    mockPool = createTestPool();
    const customer = await mockPool.query("INSERT INTO customers (name) VALUES ('Kunde') RETURNING id");
    project = await Project.create(customer.rows[0].id, 'Website', 80);
  });

  test('keeps the hourly rate when none is given', async () => {
    const updated = await Project.update(project.id, 'Neue Website');
    expect(updated.name).toBe('Neue Website');
    expect(Number(updated.hourly_rate)).toBe(80);
  });

  test('changes the hourly rate, including to 0', async () => {
    expect(Number((await Project.update(project.id, 'Website', 95.5)).hourly_rate)).toBe(95.5);
    expect(Number((await Project.update(project.id, 'Website', 0)).hourly_rate)).toBe(0);
  });

  test('returns undefined for an unknown project', async () => {
    expect(await Project.update(9999, 'Website', 80)).toBeUndefined();
  });
});
