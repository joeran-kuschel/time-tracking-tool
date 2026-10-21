const { parseEntryFilter } = require('../src/utils/entryFilter');

describe('parseEntryFilter', () => {
  test('returns an open filter, newest first, for an empty query', () => {
    expect(parseEntryFilter({})).toEqual({
      filter: { q: undefined, customerId: undefined, projectId: undefined, from: null, to: null, sort: 'newest' },
    });
  });

  test('treats empty values like missing ones', () => {
    const { filter } = parseEntryFilter({ q: '', customerId: '', projectId: '', from: '', to: '', sort: '' });

    expect(filter).toMatchObject({ q: undefined, customerId: undefined, projectId: undefined, from: null, to: null, sort: 'newest' });
  });

  test('trims the search text and reads ids as numbers', () => {
    const { filter } = parseEntryFilter({ q: '  Konzept ', customerId: '3', projectId: '7', sort: 'oldest' });

    expect(filter).toMatchObject({ q: 'Konzept', customerId: 3, projectId: 7, sort: 'oldest' });
  });

  test('treats a search text of spaces as no filter', () => {
    expect(parseEntryFilter({ q: '   ' }).filter.q).toBeUndefined();
  });

  test('accepts a search text of 200 characters and rejects 201', () => {
    expect(parseEntryFilter({ q: 'a'.repeat(200) }).error).toBeUndefined();
    expect(parseEntryFilter({ q: 'a'.repeat(201) }).error).toMatch(/q must/);
  });

  test('turns the days into instants in the time zone, the last day included', () => {
    const { filter } = parseEntryFilter({ from: '2026-09-21', to: '2026-09-21', tz: 'Europe/Berlin' });

    expect(filter).toMatchObject({ from: '2026-09-20T22:00:00.000Z', to: '2026-09-21T22:00:00.000Z' });
  });

  test('accepts one day alone', () => {
    expect(parseEntryFilter({ from: '2026-09-21' }).filter).toMatchObject({ from: '2026-09-21T00:00:00.000Z', to: null });
    expect(parseEntryFilter({ to: '2026-09-21' }).filter).toMatchObject({ from: null, to: '2026-09-22T00:00:00.000Z' });
  });

  test.each([['bogus/zone'], [undefined], ['']])('falls back to UTC for the time zone %p', (tz) => {
    expect(parseEntryFilter({ from: '2026-09-21', tz }).filter.from).toBe('2026-09-21T00:00:00.000Z');
  });

  test.each([
    ['q', { q: ['a', 'b'] }],
    ['customerId', { customerId: '0' }],
    ['customerId', { customerId: '-1' }],
    ['customerId', { customerId: '1.5' }],
    ['customerId', { customerId: 'abc' }],
    ['customerId', { customerId: '99999999999' }],
    ['customerId', { customerId: ['1', '2'] }],
    ['projectId', { projectId: '0' }],
    ['projectId', { projectId: 'x' }],
    ['from', { from: '2026-02-30' }],
    ['from', { from: '2026-9-1' }],
    ['from', { from: '21.09.2026' }],
    ['from', { from: ['2026-09-01', '2026-09-02'] }],
    ['to', { to: '2026-13-01' }],
    ['to', { to: '9999-12-31' }],
    ['from', { from: '0000-01-01' }],
    ['from', { from: '0999-12-31' }],
    ['to', { to: 'today' }],
    ['from', { from: '2026-09-22', to: '2026-09-21' }],
    ['sort', { sort: 'start_time; DROP TABLE x' }],
    ['sort', { sort: 'NEWEST' }],
  ])('rejects a bad %s: %j', (name, query) => {
    expect(parseEntryFilter(query).error).toMatch(new RegExp(name));
  });

  test('accepts the first and last year, and turns the last day into a valid instant', () => {
    const { filter } = parseEntryFilter({ from: '1000-01-01', to: '9998-12-31', tz: 'UTC' })

    expect(filter).toMatchObject({ from: '1000-01-01T00:00:00.000Z', to: '9999-01-01T00:00:00.000Z' })
  })

  test('accepts a leap day and the same day for from and to', () => {
    expect(parseEntryFilter({ from: '2028-02-29', to: '2028-02-29' }).error).toBeUndefined();
  });
});
