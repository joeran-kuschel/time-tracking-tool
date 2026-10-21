const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));

const TimeEntry = require('../src/models/TimeEntry');
const { parseEntryFilter } = require('../src/utils/entryFilter');

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

describe('TimeEntry.search', () => {
  let projectId;
  const search = (query, paging) => TimeEntry.search(parseEntryFilter(query).filter, paging);
  const descriptions = (result) => result.entries.map((e) => e.description);

  beforeEach(async () => {
    mockPool = createTestPool();
    projectId = await createProject();
  });

  test('finds the text in any case, with project, rate and customer', async () => {
    await TimeEntry.create(projectId, '2026-09-01T08:00:00Z', '2026-09-01T09:00:00Z', 'Konzept schreiben');
    await TimeEntry.create(projectId, '2026-09-02T08:00:00Z', '2026-09-02T09:00:00Z', 'Meeting');

    const result = await search({ q: 'KONZEPT' });

    expect(descriptions(result)).toEqual(['Konzept schreiben']);
    expect(result.entries[0]).toMatchObject({ project_name: 'Projekt', customer_name: 'Kunde' });
    expect(result.entries[0]).toHaveProperty('hourly_rate');
  });

  test('finds the text in the middle of a description', async () => {
    await TimeEntry.create(projectId, '2026-09-01T08:00:00Z', '2026-09-01T09:00:00Z', 'Erstes Konzept fertig');

    expect(descriptions(await search({ q: 'konzept' }))).toEqual(['Erstes Konzept fertig']);
  });

  test.each([
    ['%', '100% fertig', 'fertig'],
    ['_', 'a_b', 'axb'],
    ['\\', 'C:\\temp', 'Ctemp'],
    ['50%', 'Rabatt 50% gegeben', 'Rabatt 500'],
    ['a_b', 'a_b', 'axb'],
  ])('matches %s literally, not as a pattern', async (q, matching, other) => {
    await TimeEntry.create(projectId, '2026-09-01T08:00:00Z', '2026-09-01T09:00:00Z', matching);
    await TimeEntry.create(projectId, '2026-09-02T08:00:00Z', '2026-09-02T09:00:00Z', other);

    expect(descriptions(await search({ q }))).toEqual([matching]);
  });

  test('never matches an entry without a description', async () => {
    await TimeEntry.create(projectId, '2026-09-01T08:00:00Z', '2026-09-01T09:00:00Z', null);
    await TimeEntry.create(projectId, '2026-09-02T08:00:00Z', '2026-09-02T09:00:00Z', 'x');

    expect((await search({ q: 'x' })).total).toBe(1);
    expect((await search({})).total).toBe(2);
  });

  test('treats quotes in the text as text', async () => {
    await TimeEntry.create(projectId, '2026-09-01T08:00:00Z', '2026-09-01T09:00:00Z', "it's");

    expect(descriptions(await search({ q: "'; DROP TABLE time_entries; --" }))).toEqual([]);
    expect(descriptions(await search({ q: "it's" }))).toEqual(["it's"]);
  });

  test('filters by customer and project; a project of another customer gives an empty result', async () => {
    const other = await mockPool.query("INSERT INTO customers (name) VALUES ('Zweiter') RETURNING id");
    const otherCustomerId = other.rows[0].id;
    const second = await mockPool.query('INSERT INTO projects (customer_id, name) VALUES ($1, $2) RETURNING id', [otherCustomerId, 'App']);
    const secondProject = second.rows[0].id;
    const sibling = await mockPool.query('INSERT INTO projects (customer_id, name) VALUES (1, $1) RETURNING id', ['Zweites']);
    await TimeEntry.create(projectId, '2026-09-01T08:00:00Z', '2026-09-01T09:00:00Z', 'eins');
    await TimeEntry.create(secondProject, '2026-09-02T08:00:00Z', '2026-09-02T09:00:00Z', 'zwei');
    await TimeEntry.create(sibling.rows[0].id, '2026-09-03T08:00:00Z', '2026-09-03T09:00:00Z', 'drei');

    expect(descriptions(await search({ customerId: '1' }))).toEqual(['drei', 'eins']);
    expect(descriptions(await search({ customerId: String(otherCustomerId) }))).toEqual(['zwei']);
    expect(descriptions(await search({ projectId: String(secondProject) }))).toEqual(['zwei']);
    expect(descriptions(await search({ customerId: '1', projectId: String(sibling.rows[0].id) }))).toEqual(['drei']);
    const foreign = await search({ customerId: '1', projectId: String(secondProject) });
    expect(foreign).toEqual({ entries: [], total: 0, hours: 0 });
  });

  describe.each([['UTC', 0], ['Europe/Berlin', 2]])('date range in %s', (tz, offsetHours) => {
    // Local clock times on the days around 2026-09-21..22 as UTC instants
    const at = (day, time) => {
      const [h, m] = time.split(':').map(Number);
      return new Date(Date.UTC(2026, 8, day, h - offsetHours, m)).toISOString();
    };

    test('includes 00:00 on from and 23:59 on to, excludes 00:00 the day after to', async () => {
      await TimeEntry.create(projectId, at(20, '23:59'), at(21, '00:30'), 'vorher');
      await TimeEntry.create(projectId, at(21, '00:00'), at(21, '01:00'), 'von 00:00');
      await TimeEntry.create(projectId, at(22, '23:59'), at(23, '00:30'), 'bis 23:59');
      await TimeEntry.create(projectId, at(23, '00:00'), at(23, '01:00'), 'danach');

      const result = await search({ from: '2026-09-21', to: '2026-09-22', tz });

      expect(descriptions(result)).toEqual(['bis 23:59', 'von 00:00']);
    });

    test('accepts from or to alone', async () => {
      await TimeEntry.create(projectId, at(20, '12:00'), at(20, '13:00'), 'früh');
      await TimeEntry.create(projectId, at(25, '12:00'), at(25, '13:00'), 'spät');

      expect(descriptions(await search({ from: '2026-09-21', tz }))).toEqual(['spät']);
      expect(descriptions(await search({ to: '2026-09-21', tz }))).toEqual(['früh']);
    });
  });

  test('an entry belongs to the day it starts in', async () => {
    await TimeEntry.create(projectId, '2026-09-21T22:00:00Z', '2026-09-22T06:00:00Z', 'über Mitternacht');

    expect((await search({ from: '2026-09-21', to: '2026-09-21', tz: 'UTC' })).total).toBe(1);
    expect((await search({ from: '2026-09-22', to: '2026-09-22', tz: 'UTC' })).total).toBe(0);
    // 22:00 UTC is already the 22nd in Berlin
    expect((await search({ from: '2026-09-22', to: '2026-09-22', tz: 'Europe/Berlin' })).total).toBe(1);
  });

  test('sorts newest first by default, oldest first on request, and breaks ties by id', async () => {
    const a = await TimeEntry.create(projectId, '2026-09-01T08:00:00Z', '2026-09-01T09:00:00Z', 'a');
    const b = await TimeEntry.create(projectId, '2026-09-02T08:00:00Z', '2026-09-02T09:00:00Z', 'b');
    const c = await TimeEntry.create(projectId, '2026-09-02T08:00:00Z', '2026-09-02T09:00:00Z', 'c');

    expect((await search({})).entries.map((e) => e.id)).toEqual([c.id, b.id, a.id]);
    expect((await search({ sort: 'oldest' })).entries.map((e) => e.id)).toEqual([a.id, b.id, c.id]);
  });

  test('pages with limit and offset while total counts all matches', async () => {
    for (let day = 1; day <= 5; day++) {
      await TimeEntry.create(projectId, `2026-09-0${day}T08:00:00Z`, `2026-09-0${day}T09:00:00Z`, `Tag ${day}`);
    }

    const first = await search({}, { limit: 2, offset: 0 });
    const second = await search({}, { limit: 2, offset: 2 });
    const last = await search({}, { limit: 2, offset: 4 });

    expect(descriptions(first)).toEqual(['Tag 5', 'Tag 4']);
    expect(descriptions(second)).toEqual(['Tag 3', 'Tag 2']);
    expect(descriptions(last)).toEqual(['Tag 1']);
    expect([first.total, second.total, last.total]).toEqual([5, 5, 5]);
    expect(first.hours).toBe(5);
  });

  test('returns all rows without a limit', async () => {
    for (let day = 1; day <= 5; day++) {
      await TimeEntry.create(projectId, `2026-09-0${day}T08:00:00Z`, `2026-09-0${day}T09:00:00Z`, `Tag ${day}`);
    }

    expect((await search({}, { limit: null })).entries).toHaveLength(5);
    expect((await search({})).entries).toHaveLength(5);
  });

  test('sums the hours of finished entries; running entries count but add no hours', async () => {
    await TimeEntry.create(projectId, '2026-09-01T08:00:00Z', '2026-09-01T09:30:00Z', 'fertig');
    await TimeEntry.create(projectId, '2026-09-02T08:00:00Z', '2026-09-02T08:45:00Z', 'fertig 2');
    await TimeEntry.create(projectId, '2026-09-03T08:00:00Z', null, 'läuft');

    const result = await search({});

    expect(result.total).toBe(3);
    expect(result.hours).toBe(2.25);
  });

  test('lists every entry exactly once across pages when many start at the same time', async () => {
    const ids = [];
    for (let i = 0; i < 7; i++) {
      ids.push((await TimeEntry.create(projectId, '2026-09-02T08:00:00Z', '2026-09-02T09:00:00Z', `gleich ${i}`)).id);
    }

    for (const sort of ['newest', 'oldest']) {
      const seen = [];
      for (let offset = 0; offset < 7; offset += 3) {
        seen.push(...(await search({ sort }, { limit: 3, offset })).entries.map((e) => e.id));
      }
      expect(seen).toEqual(sort === 'newest' ? [...ids].reverse() : ids);
    }
  });

  test('answers an empty page, but the right total, for an offset past the end', async () => {
    await TimeEntry.create(projectId, '2026-09-01T08:00:00Z', '2026-09-01T09:00:00Z', 'x');

    expect(await search({}, { limit: 50, offset: 50 })).toEqual({ entries: [], total: 1, hours: 1 });
  });

  test('combines text, customer, project and dates (the parameters keep their order)', async () => {
    const other = await mockPool.query("INSERT INTO customers (name) VALUES ('Zweiter') RETURNING id");
    const second = await mockPool.query('INSERT INTO projects (customer_id, name) VALUES ($1, $2) RETURNING id', [other.rows[0].id, 'App']);
    await TimeEntry.create(projectId, '2026-09-10T08:00:00Z', '2026-09-10T09:00:00Z', 'Konzept');
    await TimeEntry.create(projectId, '2026-09-10T10:00:00Z', '2026-09-10T11:00:00Z', 'Meeting');
    await TimeEntry.create(projectId, '2026-08-10T08:00:00Z', '2026-08-10T09:00:00Z', 'Konzept alt');
    await TimeEntry.create(second.rows[0].id, '2026-09-10T08:00:00Z', '2026-09-10T09:00:00Z', 'Konzept fremd');

    const result = await search({ q: 'konzept', customerId: '1', projectId: String(projectId), from: '2026-09-01', to: '2026-09-30', sort: 'oldest' });

    expect(descriptions(result)).toEqual(['Konzept']);
    expect(result).toMatchObject({ total: 1, hours: 1 });
  });

  test('sums the hours of the matches only, with fractions of an hour', async () => {
    await TimeEntry.create(projectId, '2026-09-01T08:00:00Z', '2026-09-01T08:20:00Z', 'treffer');
    await TimeEntry.create(projectId, '2026-09-02T08:00:00Z', '2026-09-02T10:00:00Z', 'anderes');

    const result = await search({ q: 'treffer' });

    expect(result.hours).toBeCloseTo(1 / 3, 5);
  });

  test('a running entry that matches is listed and counted, with 0 hours', async () => {
    await TimeEntry.create(projectId, '2026-09-03T08:00:00Z', null, 'läuft');

    const result = await search({ q: 'läuft' });

    expect(result).toMatchObject({ total: 1, hours: 0 });
    expect(result.entries[0].end_time).toBeNull();
  });

  // Berlin: the clocks go forward on 29 March 2026 (23 hour day) and back on 25 October 2026 (25 hour day)
  test.each([
    ['23 hour day', '2026-03-29', '2026-03-28T23:00:00Z', '2026-03-29T21:59:00Z', '2026-03-28T22:59:00Z', '2026-03-29T22:00:00Z'],
    ['25 hour day', '2026-10-25', '2026-10-24T22:00:00Z', '2026-10-25T22:59:00Z', '2026-10-24T21:59:00Z', '2026-10-25T23:00:00Z'],
  ])('a daylight saving %s holds the entries from 00:00 to 23:59 local, and none of its neighbours', async (_name, day, first, last, before, after) => {
    const ended = (start) => new Date(Date.parse(start) + 60000).toISOString();
    await TimeEntry.create(projectId, before, ended(before), 'Vortag 23:59');
    await TimeEntry.create(projectId, first, ended(first), 'Mitternacht');
    await TimeEntry.create(projectId, last, ended(last), 'Abend');
    await TimeEntry.create(projectId, after, ended(after), 'Folgetag 00:00');

    const result = await search({ from: day, to: day, tz: 'Europe/Berlin' });

    expect(descriptions(result)).toEqual(['Abend', 'Mitternacht']);
  });

  test('answers total 0 and hours 0 when nothing matches', async () => {
    await TimeEntry.create(projectId, '2026-09-01T08:00:00Z', '2026-09-01T09:00:00Z', 'x');

    expect(await search({ q: 'nichts' })).toEqual({ entries: [], total: 0, hours: 0 });
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
