const { parseMonth, previousMonth, nextMonth, parseTimeZone, monthRange } = require('../src/utils/period');

describe('parseMonth', () => {
  test('parses month and year from query strings', () => {
    expect(parseMonth('9', '2026')).toEqual({ month: 9, year: 2026 });
  });

  test.each([
    [undefined, '2026'], ['0', '2026'], ['13', '2026'], ['9', undefined], ['9.5', '2026'], ['sep', '2026'],
  ])('rejects month %p and year %p', (month, year) => {
    expect(parseMonth(month, year)).toBeNull();
  });
});

describe('previousMonth', () => {
  test('goes back one month, across the turn of the year', () => {
    expect(previousMonth({ month: 9, year: 2026 })).toEqual({ month: 8, year: 2026 });
    expect(previousMonth({ month: 1, year: 2026 })).toEqual({ month: 12, year: 2025 });
  });
});

describe('nextMonth', () => {
  test('goes forward one month, across the turn of the year', () => {
    expect(nextMonth({ month: 9, year: 2026 })).toEqual({ month: 10, year: 2026 });
    expect(nextMonth({ month: 12, year: 2026 })).toEqual({ month: 1, year: 2027 });
  });
});

describe('parseTimeZone', () => {
  test('keeps a known IANA time zone', () => {
    expect(parseTimeZone('Europe/Berlin')).toBe('Europe/Berlin');
  });

  test.each([undefined, '', 'Mars/Base', ['Europe/Berlin']])('falls back to UTC for %p', (value) => {
    expect(parseTimeZone(value)).toBe('UTC');
  });
});

describe('monthRange', () => {
  test('starts and ends at midnight UTC in UTC', () => {
    expect(monthRange({ month: 9, year: 2026 }, 'UTC')).toEqual({ from: '2026-09-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' });
  });

  test('starts and ends at local midnight, also when daylight saving time ends in the month', () => {
    expect(monthRange({ month: 10, year: 2026 }, 'Europe/Berlin')).toEqual({ from: '2026-09-30T22:00:00.000Z', to: '2026-10-31T23:00:00.000Z' });
  });

  test('handles daylight saving time starting in the month', () => {
    expect(monthRange({ month: 3, year: 2026 }, 'Europe/Berlin')).toEqual({ from: '2026-02-28T23:00:00.000Z', to: '2026-03-31T22:00:00.000Z' });
  });

  test('reaches into the next year for December, and works west of UTC', () => {
    expect(monthRange({ month: 12, year: 2026 }, 'America/New_York')).toEqual({ from: '2026-12-01T05:00:00.000Z', to: '2027-01-01T05:00:00.000Z' });
  });

  test('works with time zones that are not whole hours', () => {
    expect(monthRange({ month: 9, year: 2026 }, 'Asia/Kolkata')).toEqual({ from: '2026-08-31T18:30:00.000Z', to: '2026-09-30T18:30:00.000Z' });
  });
});
