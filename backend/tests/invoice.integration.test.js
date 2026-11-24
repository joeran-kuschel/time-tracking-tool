const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
  connect: (...args) => mockPool.connect(...args),
}));

const Customer = require('../src/models/Customer');
const Project = require('../src/models/Project');
const TimeEntry = require('../src/models/TimeEntry');
const Settings = require('../src/models/Settings');
const Invoice = require('../src/models/Invoice');
const controller = require('../src/controllers/invoiceController');
const { reportAmounts } = require('../src/utils/amounts');
const { withBilledHours, roundingRuleOf } = require('../src/utils/rounding');

// The invoice controller with the real models on the real schema (pg-mem): what the SQL of the period and the joins hand to
// the rules. Only the HTTP objects are fake.
function mockResponse() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.end = jest.fn(() => res);
  res.contentType = jest.fn(() => res);
  res.setHeader = jest.fn(() => res);
  return res;
}

async function call(handler, req) {
  const res = mockResponse();
  await handler(req, res);
  return res;
}

const BODY = { from: '2026-02-01', to: '2026-02-28', tz: 'Europe/Berlin', invoiceDate: '2026-03-05' };
const DETAILS = { senderName: 'Jana Beispiel', senderAddress: 'Weg 5', senderTaxId: '12/345' };

let customer;
let website;
let advice;

beforeEach(async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockPool = createTestPool();
  await Settings.update(DETAILS);
  customer = await Customer.create('Muster GmbH', null, null, null, { address: 'Musterweg 1', taxId: null });
  website = await Project.create(customer.id, 'Website', '80.00');
  advice = await Project.create(customer.id, 'Beratung', '95.00');
});

afterEach(() => console.error.mockRestore());

const preview = async (body = {}) => call(controller.preview, { body: { customerId: customer.id, ...BODY, ...body } });
const create = async (body = {}) => call(controller.create, { body: { customerId: customer.id, ...BODY, ...body } });

describe('the entries of the period, with the real SQL', () => {
  // Berlin is UTC+1 in February: February starts at 23:00 UTC on 31 January and ends at 23:00 UTC on 28 February
  test('counts an entry by its start in the time zone: the first and the last minute belong in, the next one does not', async () => {
    await TimeEntry.create(website.id, '2026-01-31T23:00:00Z', '2026-01-31T23:30:00Z');
    await TimeEntry.create(website.id, '2026-02-28T22:30:00Z', '2026-02-28T23:30:00Z');
    await TimeEntry.create(website.id, '2026-01-31T22:30:00Z', '2026-01-31T22:45:00Z');
    await TimeEntry.create(website.id, '2026-02-28T23:00:00Z', '2026-02-28T23:15:00Z');

    const { lines } = (await preview()).json.mock.calls[0][0];

    expect(lines).toEqual([expect.objectContaining({ name: 'Website', minutes: 90, amount: '120.00' })]);
  });

  test('an entry that starts on the last day and ends after midnight is counted whole, in the period it started', async () => {
    await TimeEntry.create(website.id, '2026-02-28T22:00:00Z', '2026-03-01T00:00:00Z');

    const { lines } = (await preview()).json.mock.calls[0][0];

    expect(lines[0]).toMatchObject({ minutes: 120, amount: '160.00' });
  });

  test('a running timer in the period is not billed, and a project with only a running timer has no line', async () => {
    await TimeEntry.create(website.id, '2026-02-10T08:00:00Z', '2026-02-10T09:00:00Z');
    await TimeEntry.create(advice.id, '2026-02-11T08:00:00Z', null);

    const { lines, net, missing } = (await preview()).json.mock.calls[0][0];

    expect(lines.map((line) => line.name)).toEqual(['Website']);
    expect(net).toBe('80.00');
    expect(missing).toEqual([]);
  });

  test('only the customer of the invoice is billed', async () => {
    const other = await Customer.create('Anderer', null, null, null, null);
    const otherProject = await Project.create(other.id, 'Fremd', '50.00');
    await TimeEntry.create(otherProject.id, '2026-02-10T08:00:00Z', '2026-02-10T09:00:00Z');

    const res = await preview();

    expect(res.json.mock.calls[0][0]).toMatchObject({ lines: [], missing: ['noEntries'] });
  });

  test('the lines are sorted by project name, and the totals add up exactly like the report', async () => {
    await TimeEntry.create(website.id, '2026-02-02T08:00:00Z', '2026-02-02T09:05:00Z');
    await TimeEntry.create(advice.id, '2026-02-03T08:00:00Z', '2026-02-03T09:05:00Z');
    await TimeEntry.create(website.id, '2026-02-04T08:00:00Z', '2026-02-04T08:07:00Z');

    const body = (await preview()).json.mock.calls[0][0];

    const stored = await TimeEntry.getByCustomerIdInRange(customer.id, { from: '2026-01-31T23:00:00.000Z', to: '2026-02-28T23:00:00.000Z' });
    const report = reportAmounts(withBilledHours(stored, roundingRuleOf(await Settings.get())));
    expect(body.lines.map((line) => line.name)).toEqual(['Beratung', 'Website']);
    expect(Number(body.net) * 100).toBe(report.totalCents);
    expect(body.lines.reduce((sum, line) => sum + Number(line.amount) * 100, 0)).toBe(report.totalCents);
    expect(body.vat).toBe('37.79');
  });

  test("the customer's own rounding rule wins over the global one, as in the report", async () => {
    await Settings.update({ roundingMinutes: 15, roundingDirection: 'up' });
    await Customer.update(customer.id, customer.name, null, { minutes: 60, direction: 'up' });
    await TimeEntry.create(website.id, '2026-02-02T08:00:00Z', '2026-02-02T08:20:00Z');

    const { lines } = (await preview()).json.mock.calls[0][0];

    expect(lines[0]).toMatchObject({ minutes: 60, amount: '80.00' });
  });

  test('the global rounding rule applies to a customer without an own rule', async () => {
    await Settings.update({ roundingMinutes: 15, roundingDirection: 'up' });
    await TimeEntry.create(website.id, '2026-02-02T08:00:00Z', '2026-02-02T08:20:00Z');

    const { lines } = (await preview()).json.mock.calls[0][0];

    expect(lines[0]).toMatchObject({ minutes: 30, amount: '40.00' });
  });

  test('a period in another time zone has its own limits', async () => {
    // 04:00 UTC on 1 February is 20:00 on 31 January in Los Angeles, so it is not in February there, but it is in Berlin
    await TimeEntry.create(website.id, '2026-02-01T04:00:00Z', '2026-02-01T05:00:00Z');

    const berlin = (await preview()).json.mock.calls[0][0];
    const losAngeles = (await preview({ tz: 'America/Los_Angeles' })).json.mock.calls[0][0];

    expect(berlin.lines).toHaveLength(1);
    expect(losAngeles.lines).toHaveLength(0);
  });
});

describe('creating, with the real models', () => {
  beforeEach(async () => {
    await TimeEntry.create(website.id, '2026-02-02T08:00:00Z', '2026-02-02T09:05:00Z');
  });

  test('stores the invoice with the numbers of the preview, a real PDF and its lines', async () => {
    const shown = (await preview()).json.mock.calls[0][0];

    const res = await create();

    expect(res.status).toHaveBeenCalledWith(201);
    const made = res.json.mock.calls[0][0];
    expect(made).toMatchObject({ number: shown.number, net: shown.net, vat: shown.vat, gross: shown.gross, customerName: 'Muster GmbH', invoiceDate: '2026-03-05' });
    expect((await Invoice.getPdf(made.id)).pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const lines = (await mockPool.query('SELECT description, minutes, amount_cents FROM invoice_lines WHERE invoice_id = $1', [made.id])).rows;
    expect(lines).toEqual([{ description: 'Website', minutes: 65, amount_cents: 8667 }]);
  });

  test('the second invoice gets the next number, and a preview afterwards shows the one after that', async () => {
    await create();
    const second = (await create()).json.mock.calls[0][0];

    expect(second.number).toBe('2026-0002');
    expect((await preview()).json.mock.calls[0][0].number).toBe('2026-0003');
  });

  test('a pattern with a year counts again in the next year; one without it keeps counting', async () => {
    await create();
    const nextYear = (await create({ invoiceDate: '2027-01-02' })).json.mock.calls[0][0];
    expect(nextYear.number).toBe('2027-0001');

    await Settings.update({ invoiceNumberPattern: 'RE-{NNN}' });
    const first = (await create()).json.mock.calls[0][0];
    const later = (await create({ invoiceDate: '2027-06-01' })).json.mock.calls[0][0];
    expect([first.number, later.number]).toEqual(['RE-001', 'RE-002']);
  });

  test('missing details store nothing and use no number', async () => {
    await mockPool.query('UPDATE settings SET sender_tax_id = NULL WHERE id = 1');

    const res = await create();

    expect(res.status).toHaveBeenCalledWith(422);
    expect(await Invoice.getAll()).toEqual([]);
    expect((await preview()).json.mock.calls[0][0].number).toBe('2026-0001');
  });

  test('a number that another invoice has answers 409 and leaves the counter where it was', async () => {
    await create();
    await mockPool.query("UPDATE invoice_counters SET next_number = 1 WHERE scope_year = 2026");

    const res = await create();

    expect(res.status).toHaveBeenCalledWith(409);
    expect((await Invoice.getAll()).map((invoice) => invoice.number)).toEqual(['2026-0001']);
  });

  test('an invoice for a customer that is gone later keeps its copy of the details', async () => {
    const made = (await create()).json.mock.calls[0][0];
    await Customer.delete(customer.id);

    const list = (await call(controller.getAll, {})).json.mock.calls[0][0];

    expect(list).toEqual([expect.objectContaining({ id: made.id, customerId: null, customerName: 'Muster GmbH' })]);
  });
});

describe('groupByTask: rounding once per day and task', () => {
  const rule = { roundingMinutes: 15, roundingDirection: 'up' };
  // Three blocks of 5 minutes of one task on one day, with a call in between
  beforeEach(async () => {
    await Settings.update(rule);
    await TimeEntry.create(website.id, '2026-02-10T09:00:00Z', '2026-02-10T09:05:00Z', 'review', 'Fix login');
    await TimeEntry.create(website.id, '2026-02-10T10:00:00Z', '2026-02-10T10:05:00Z', 'call', null);
    await TimeEntry.create(website.id, '2026-02-10T11:00:00Z', '2026-02-10T11:05:00Z', 'redirect', 'fix login');
    await TimeEntry.create(website.id, '2026-02-10T12:00:00Z', '2026-02-10T12:05:00Z', 'tests', 'Fix login');
  });

  test('rounds every entry on its own by default', async () => {
    const { lines } = (await preview()).json.mock.calls[0][0];

    expect(lines[0].minutes).toBe(60);
  });

  test('rounds the blocks of a task as one when groupByTask is true', async () => {
    const { lines } = (await preview({ groupByTask: true })).json.mock.calls[0][0];

    // 15 minutes of the task rounded as one (15) plus the call rounded on its own (15)
    expect(lines[0].minutes).toBe(30);
  });

  test('answers 400 for a groupByTask that is not true or false, and stores nothing', async () => {
    const res = await preview({ groupByTask: 'yes' });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'groupByTask must be true or false' });
  });
});

describe('groupByTask: days in the time zone, running timers and the stored invoice', () => {
  beforeEach(() => Settings.update({ roundingMinutes: 15, roundingDirection: 'up' }));

  test('a task is summed per day of the invoice time zone: 23:30 and 00:30 Berlin time are two days', async () => {
    // Berlin is UTC+1 in February: these start at 23:30 on 10 February and 00:30 on 11 February, 5 minutes each
    await TimeEntry.create(website.id, '2026-02-10T22:30:00Z', '2026-02-10T22:35:00Z', null, 'Fix login');
    await TimeEntry.create(website.id, '2026-02-10T23:30:00Z', '2026-02-10T23:35:00Z', null, 'Fix login');

    const { lines } = (await preview({ groupByTask: true })).json.mock.calls[0][0];

    expect(lines[0].minutes).toBe(30);
    expect((await preview({ groupByTask: true, tz: 'UTC' })).json.mock.calls[0][0].lines[0].minutes).toBe(15);
  });

  test('a running timer with a task is not billed and does not change the rounded row', async () => {
    await TimeEntry.create(website.id, '2026-02-10T09:00:00Z', '2026-02-10T09:05:00Z', null, 'Fix login');
    await TimeEntry.create(website.id, '2026-02-10T10:00:00Z', null, null, 'Fix login');

    const { lines } = (await preview({ groupByTask: true })).json.mock.calls[0][0];

    expect(lines).toEqual([expect.objectContaining({ minutes: 15 })]);
  });

  test('entries of different projects with one task are not merged', async () => {
    await TimeEntry.create(website.id, '2026-02-10T09:00:00Z', '2026-02-10T09:05:00Z', null, 'Fix login');
    await TimeEntry.create(advice.id, '2026-02-10T10:00:00Z', '2026-02-10T10:05:00Z', null, 'Fix login');

    const { lines } = (await preview({ groupByTask: true })).json.mock.calls[0][0];

    expect(lines.map((line) => [line.name, line.minutes]).sort()).toEqual([['Beratung', 15], ['Website', 15]]);
  });

  test('without tasks, groupByTask changes nothing', async () => {
    await TimeEntry.create(website.id, '2026-02-10T09:00:00Z', '2026-02-10T09:05:00Z', 'a');
    await TimeEntry.create(website.id, '2026-02-10T10:00:00Z', '2026-02-10T10:05:00Z', 'b');

    const plain = (await preview()).json.mock.calls[0][0];
    const grouped = (await preview({ groupByTask: true })).json.mock.calls[0][0];

    expect(grouped.lines).toEqual(plain.lines);
    expect(grouped.net).toBe(plain.net);
  });

  test('the stored invoice has the rounded grouped line and the amounts of the preview', async () => {
    await TimeEntry.create(website.id, '2026-02-10T09:00:00Z', '2026-02-10T09:05:00Z', 'a', 'Fix login');
    await TimeEntry.create(website.id, '2026-02-10T10:00:00Z', '2026-02-10T10:05:00Z', 'b', 'fix login');
    await TimeEntry.create(website.id, '2026-02-10T11:00:00Z', '2026-02-10T11:05:00Z', 'c', 'Fix login');
    const shown = (await preview({ groupByTask: true })).json.mock.calls[0][0];

    const made = (await create({ groupByTask: true })).json.mock.calls[0][0];

    const stored = (await mockPool.query('SELECT minutes, amount_cents FROM invoice_lines WHERE invoice_id = $1', [made.id])).rows;
    // 15 minutes of the task rounded as one = 15 minutes at 80.00 per hour
    expect(stored).toEqual([{ minutes: 15, amount_cents: 2000 }]);
    expect(made.net).toBe(shown.net);
  });
});
