const { roundMinutes, reportMinutes, minutesToHours, formatDuration } = require('../src/utils/hours');

const entry = (overrides) => ({ start_time: '2026-09-21T08:00:00Z', end_time: '2026-09-21T09:30:00Z', ...overrides });
const endAfterSeconds = (seconds) => entry({ end_time: new Date(Date.parse('2026-09-21T08:00:00Z') + seconds * 1000).toISOString() });

describe('formatDuration', () => {
  test.each([
    [0, '0:00 h'],
    [5, '0:05 h'],
    [59, '0:59 h'],
    [60, '1:00 h'],
    [239, '3:59 h'],
    [6045, '100:45 h'],
    [-90, '-1:30 h'],
    [-5, '-0:05 h'],
  ])('%p minutes is %p', (minutes, text) => {
    expect(formatDuration(minutes)).toBe(text);
  });

  test('never writes -0:00', () => {
    expect(formatDuration(-0)).toBe('0:00 h');
    expect(formatDuration(-0.4)).toBe('0:00 h');
  });

  test('rounds fractions of a minute half away from zero', () => {
    expect(formatDuration(59.5)).toBe('1:00 h');
    expect(formatDuration(59.4)).toBe('0:59 h');
    expect(formatDuration(-59.5)).toBe('-1:00 h');
  });
});

describe('roundMinutes', () => {
  test('rounds half away from zero and never gives -0', () => {
    expect([roundMinutes(0.5), roundMinutes(-0.5), roundMinutes(1.49), roundMinutes(-0.2), roundMinutes(NaN)]).toEqual([1, -1, 1, 0, 0]);
    expect(Object.is(roundMinutes(-0.2), 0)).toBe(true);
  });
});

describe('reportMinutes', () => {
  test('counts the whole minutes between start and end', () => {
    expect(reportMinutes(entry())).toBe(90);
  });

  test('29 seconds are no minute, 30 seconds are one (half up)', () => {
    expect(reportMinutes(endAfterSeconds(29))).toBe(0);
    expect(reportMinutes(endAfterSeconds(30))).toBe(1);
    expect(reportMinutes(endAfterSeconds(89))).toBe(1);
    expect(reportMinutes(endAfterSeconds(90))).toBe(2);
  });

  test('counts a running entry as 0', () => {
    expect(reportMinutes(entry({ end_time: null }))).toBe(0);
  });

  test('keeps the negative minutes of an entry that ends before it starts', () => {
    expect(reportMinutes(entry({ end_time: '2026-09-21T07:00:00Z' }))).toBe(-60);
    expect(reportMinutes(endAfterSeconds(-10))).toBe(0);
    expect(Object.is(reportMinutes(endAfterSeconds(-10)), 0)).toBe(true);
  });

  test('uses the billed hours of a rounding rule instead of the times', () => {
    expect(reportMinutes(entry({ billed_hours: '1.25' }))).toBe(75);
    expect(reportMinutes(entry({ billed_hours: '0.08' }))).toBe(5);
    expect(reportMinutes(entry({ billed_hours: '0.00' }))).toBe(0);
  });

  test('uses the billed hours of a running entry too', () => {
    expect(reportMinutes(entry({ end_time: null, billed_hours: '0.50' }))).toBe(30);
  });

  test('counts an invalid date as 0', () => {
    expect(reportMinutes(entry({ end_time: 'not a date' }))).toBe(0);
  });
});

describe('minutesToHours', () => {
  test.each([[0, '0.00'], [5, '0.08'], [65, '1.08'], [90, '1.50'], [6045, '100.75'], [-60, '-1.00']])('%p minutes are %p hours', (minutes, hours) => {
    expect(minutesToHours(minutes)).toBe(hours);
  });
});
