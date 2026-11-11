const { roundingRuleOf, billedHours, withBilledHours } = require('../src/utils/rounding');

// An entry of the given length in minutes (and seconds)
const entry = (minutes, seconds = 0) => ({
  start_time: '2026-09-21T08:00:00Z',
  end_time: new Date(Date.UTC(2026, 8, 21, 8, minutes, seconds)).toISOString(),
});
const up15 = { minutes: 15, direction: 'up' };
const nearest15 = { minutes: 15, direction: 'nearest' };
const up30 = { minutes: 30, direction: 'up' };
const nearest30 = { minutes: 30, direction: 'nearest' };

describe('roundingRuleOf', () => {
  test.each([
    [{ roundingMinutes: 15, roundingDirection: 'up' }, { minutes: 15, direction: 'up' }],
    [{ roundingMinutes: 30, roundingDirection: 'nearest' }, { minutes: 30, direction: 'nearest' }],
    [{ roundingMinutes: 15, roundingDirection: 'something' }, { minutes: 15, direction: 'up' }],
  ])('turns %j into %j', (settings, rule) => {
    expect(roundingRuleOf(settings)).toEqual(rule);
  });

  test.each([[{ roundingMinutes: 0, roundingDirection: 'up' }], [{}], [undefined], [null], [{ roundingMinutes: -15 }]])(
    'means no rounding for %j', (settings) => {
      expect(roundingRuleOf(settings)).toBeNull();
    }
  );
});

describe('billedHours', () => {
  // The cases of the issue (#12), one minute either side of the halfway points included
  test.each([
    ['quarter hour, up', up15, [[65, '1.25'], [75, '1.25'], [76, '1.50'], [1, '0.25'], [14, '0.25'], [15, '0.25'], [16, '0.50'], [60, '1.00'], [61, '1.25']]],
    ['quarter hour, nearest', nearest15, [[65, '1.00'], [68, '1.25'], [67, '1.00'], [76, '1.25'], [5, '0.25'], [7, '0.25'], [8, '0.25'], [22, '0.25'], [23, '0.50'], [60, '1.00']]],
    ['half hour, up', up30, [[20, '0.50'], [30, '0.50'], [31, '1.00'], [1, '0.50'], [60, '1.00'], [61, '1.50']]],
    ['half hour, nearest', nearest30, [[14, '0.50'], [15, '0.50'], [44, '0.50'], [45, '1.00'], [1, '0.50'], [30, '0.50'], [60, '1.00'], [74, '1.00'], [75, '1.50']]],
  ])('%s', (name, rule, cases) => {
    for (const [minutes, hours] of cases) {
      expect([name, minutes, billedHours(entry(minutes), rule)]).toEqual([name, minutes, hours]);
    }
  });

  test('rounds on the second: 15 minutes and 1 second go up, 7 minutes 29 seconds go down, 7 minutes 30 seconds go up', () => {
    expect(billedHours(entry(15, 1), up15)).toBe('0.50');
    expect(billedHours(entry(15, 0), up15)).toBe('0.25');
    expect(billedHours(entry(7, 29), nearest15)).toBe('0.25'); // below half a step: the minimum of one step
    expect(billedHours(entry(37, 29), nearest15)).toBe('0.50');
    expect(billedHours(entry(37, 30), nearest15)).toBe('0.75');
    expect(billedHours(entry(22, 29), nearest15)).toBe('0.25');
    expect(billedHours(entry(22, 30), nearest15)).toBe('0.50');
  });

  test('an entry of 0 minutes stays 0, also with a rule', () => {
    expect(billedHours(entry(0), up15)).toBe('0.00');
    expect(billedHours(entry(0), nearest30)).toBe('0.00');
  });

  test('a long entry rounds like a short one and has no float error', () => {
    expect(billedHours(entry(9 * 60 + 1), up15)).toBe('9.25');
    expect(billedHours(entry(9 * 60 + 8), nearest15)).toBe('9.25');
    expect(billedHours(entry(100 * 60 + 1), up30)).toBe('100.50');
  });

  test('has no billed hours without a rule, for a running entry and for one that ends before it starts', () => {
    expect(billedHours(entry(65), null)).toBeNull();
    expect(billedHours({ start_time: '2026-09-21T08:00:00Z', end_time: null }, up15)).toBeNull();
    expect(billedHours({ start_time: '2026-09-21T12:00:00Z', end_time: '2026-09-21T10:30:00Z' }, up15)).toBeNull();
    expect(billedHours({ start_time: 'nonsense', end_time: 'nonsense' }, up15)).toBeNull();
  });

  test('has no billed hours when only the start or only the end is invalid', () => {
    expect(billedHours({ start_time: 'nonsense', end_time: '2026-09-21T10:30:00Z' }, up15)).toBeNull();
    expect(billedHours({ start_time: '2026-09-21T10:30:00Z', end_time: 'nonsense' }, up15)).toBeNull();
  });

  test('is a multiple of a quarter hour for every length from 1 to 600 minutes, for every rule', () => {
    for (const rule of [up15, nearest15, up30, nearest30]) {
      for (let minutes = 1; minutes <= 600; minutes++) {
        const hours = Number(billedHours(entry(minutes), rule));
        expect((hours * 60) % rule.minutes).toBe(0);
        expect(hours).toBeGreaterThanOrEqual(rule.minutes / 60);
        // never more than one step away from the exact time (up) or half a step plus the minimum step (nearest)
        expect(Math.abs(hours * 60 - minutes)).toBeLessThanOrEqual(rule.minutes);
      }
    }
  });

  test('rounding up never gives less than the exact time', () => {
    for (let minutes = 1; minutes <= 300; minutes++) {
      expect(Number(billedHours(entry(minutes), up15)) * 60).toBeGreaterThanOrEqual(minutes);
    }
  });
});

describe('withBilledHours', () => {
  const entries = [entry(65), entry(20)];

  test('returns the entries as they are without a rule', () => {
    expect(withBilledHours(entries, null)).toBe(entries);
  });

  test('adds billed_hours to a copy and leaves the entries alone', () => {
    const result = withBilledHours(entries, up15);

    expect(result.map((e) => e.billed_hours)).toEqual(['1.25', '0.50']);
    expect(entries[0]).not.toHaveProperty('billed_hours');
    expect(result[0].start_time).toBe(entries[0].start_time);
  });
});
