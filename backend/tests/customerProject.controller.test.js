jest.mock('../src/models/Customer');
jest.mock('../src/models/Project');
jest.mock('../src/models/TimeEntry');

const Customer = require('../src/models/Customer');
const Project = require('../src/models/Project');
const TimeEntry = require('../src/models/TimeEntry');
const customers = require('../src/controllers/customerController');
const projects = require('../src/controllers/projectController');

function mockResponse() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

async function call(handler, req) {
  const res = mockResponse();
  await handler(req, res);
  return res;
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('customerController', () => {
  test('update answers 404 for an unknown customer', async () => {
    Customer.update.mockResolvedValue(undefined);
    const res = await call(customers.update, { params: { id: '9' }, body: { name: 'Neu' } });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('update saves name and email', async () => {
    Customer.update.mockResolvedValue({ id: 1, name: 'Neu', email: 'a@b.de' });
    const res = await call(customers.update, { params: { id: '1' }, body: { name: 'Neu', email: 'a@b.de' } });
    expect(Customer.update).toHaveBeenCalledWith('1', 'Neu', 'a@b.de');
    expect(res.json).toHaveBeenCalledWith({ id: 1, name: 'Neu', email: 'a@b.de' });
  });

  test('delete refuses while a timer of the customer runs', async () => {
    TimeEntry.getActive.mockResolvedValue({ id: 5, customer_id: 1, project_id: 3 });
    const res = await call(customers.delete, { params: { id: '1' } });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(Customer.delete).not.toHaveBeenCalled();
  });

  test('delete works while a timer of another customer runs', async () => {
    TimeEntry.getActive.mockResolvedValue({ id: 5, customer_id: 2, project_id: 7 });
    Customer.delete.mockResolvedValue({ id: 1 });
    const res = await call(customers.delete, { params: { id: '1' } });
    expect(res.json).toHaveBeenCalledWith({ id: 1 });
  });

  test('delete answers 404 for an unknown customer', async () => {
    TimeEntry.getActive.mockResolvedValue(undefined);
    Customer.delete.mockResolvedValue(undefined);
    const res = await call(customers.delete, { params: { id: '9' } });
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('projectController', () => {
  test.each([[-1], ['abc'], ['']])('refuses the hourly rate %p', async (hourlyRate) => {
    const created = await call(projects.create, { body: { customerId: 1, name: 'Web', hourlyRate } });
    const updated = await call(projects.update, { params: { id: '3' }, body: { name: 'Web', hourlyRate } });
    expect(created.status).toHaveBeenCalledWith(400);
    expect(updated.status).toHaveBeenCalledWith(400);
    expect(Project.create).not.toHaveBeenCalled();
    expect(Project.update).not.toHaveBeenCalled();
  });

  test('update passes a missing rate on, so the stored one is kept', async () => {
    Project.update.mockResolvedValue({ id: 3 });
    await call(projects.update, { params: { id: '3' }, body: { name: 'Web' } });
    expect(Project.update).toHaveBeenCalledWith('3', 'Web', undefined);
  });

  test('update answers 404 for an unknown project', async () => {
    Project.update.mockResolvedValue(undefined);
    const res = await call(projects.update, { params: { id: '9' }, body: { name: 'Web', hourlyRate: 80 } });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('delete refuses while the project\'s timer runs', async () => {
    TimeEntry.getActive.mockResolvedValue({ id: 5, customer_id: 1, project_id: 3 });
    const res = await call(projects.delete, { params: { id: '3' } });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(Project.delete).not.toHaveBeenCalled();
  });

  test('delete answers 404 for an unknown project', async () => {
    TimeEntry.getActive.mockResolvedValue(undefined);
    Project.delete.mockResolvedValue(undefined);
    const res = await call(projects.delete, { params: { id: '9' } });
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
