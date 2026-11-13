const { roundingRuleOf, ruleOfEntry, ruleOfCustomer, billedHours, withBilledHours, withBilling } = require('../src/utils/rounding');
const { reportAmounts, decimal } = require('../src/utils/amounts');

// An entry of the given length in minutes (and seconds)
const entry = (minutes, seconds = 0) => ({
  start_time: '2026-09-21T08:00:00Z',
  end_time: new Date(Date.UTC(2026, 8, 21, 8, minutes, seconds)).toISOString(),
});
const up15 = { minutes: 15, direction: 'up' };
const nearest15 = { minutes: 15, direction: 'nearest' };
const up30 = { minutes: 30, direction: 'up' };
const nearest30 = { minutes: 30, direction: 'nearest' };
const up5 = { minutes: 5, direction: 'up' };
const nearest5 = { minutes: 5, direction: 'nearest' };
const up10 = { minutes: 10, direction: 'up' };
const nearest10 = { minutes: 10, direction: 'nearest' };
const up60 = { minutes: 60, direction: 'up' };
const nearest60 = { minutes: 60, direction: 'nearest' };

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
    // 5 minutes: 0.0833 h, printed with two decimals like every hour of a report
    ['5 minutes, up', up5, [[1, '0.08'], [5, '0.08'], [6, '0.17'], [10, '0.17'], [11, '0.25'], [60, '1.00'], [61, '1.08'], [65, '1.08'], [66, '1.17']]],
    ['5 minutes, nearest', nearest5, [[1, '0.08'], [2, '0.08'], [3, '0.08'], [7, '0.08'], [8, '0.17'], [12, '0.17'], [13, '0.25'], [62, '1.00'], [63, '1.08']]],
    // 10 minutes: 0.1667 h
    ['10 minutes, up', up10, [[1, '0.17'], [10, '0.17'], [11, '0.33'], [20, '0.33'], [21, '0.50'], [60, '1.00'], [61, '1.17']]],
    ['10 minutes, nearest', nearest10, [[1, '0.17'], [4, '0.17'], [5, '0.17'], [14, '0.17'], [15, '0.33'], [24, '0.33'], [25, '0.50'], [64, '1.00'], [65, '1.17']]],
    ['full hour, up', up60, [[1, '1.00'], [59, '1.00'], [60, '1.00'], [61, '2.00'], [120, '2.00'], [121, '3.00']]],
    ['full hour, nearest', nearest60, [[1, '1.00'], [29, '1.00'], [30, '1.00'], [89, '1.00'], [90, '2.00'], [119, '2.00'], [150, '3.00'], [149, '2.00']]],
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

  test('a halfway case rounds up for every step, on the second', () => {
    expect(billedHours(entry(2, 29), nearest5)).toBe('0.08');
    expect(billedHours(entry(7, 30), nearest5)).toBe('0.17');
    expect(billedHours(entry(7, 29), nearest5)).toBe('0.08');
    expect(billedHours(entry(30, 0), nearest60)).toBe('1.00');
    expect(billedHours(entry(90, 0), nearest60)).toBe('2.00');
    expect(billedHours(entry(89, 59), nearest60)).toBe('1.00');
  });

  test('printed with two decimals, blocks of 5 or 10 minutes do not add up to the clean hour (documented behavior)', () => {
    const hours = (rule) => Array.from({ length: rule === up5 ? 12 : 6 }, () => Number(billedHours(entry(rule === up5 ? 5 : 10), rule))).reduce((a, b) => a + b, 0);

    expect(hours(up5)).toBeCloseTo(0.96, 10);
    expect(hours(up10)).toBeCloseTo(1.02, 10);
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
    for (const rule of [up15, nearest15, up30, nearest30, up60, nearest60]) {
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

describe('withBilling', () => {
  const priced = (minutes, rate, extra = {}) => ({ project_id: 1, project_name: 'Web', hourly_rate: rate, ...entry(minutes), ...extra });

  test('returns the entries as they are without a rule', () => {
    const entries = [priced(65, '80.00')];

    expect(withBilling(entries, null)).toBe(entries);
  });

  test('every entry carries the rule that produced the values, also a running one', () => {
    const running = priced(10, '80.00', { end_time: null });

    const result = withBilling([priced(65, '80.00'), running], nearest30);

    expect(result.map((e) => e.billed_rule)).toEqual([{ minutes: 30, direction: 'nearest' }, { minutes: 30, direction: 'nearest' }]);
  });

  test('adds billed_hours and the amount in cents of the rounded hours, as strings with two decimals', () => {
    const result = withBilling([priced(65, '80.00'), priced(20, '95.00')], up15);

    expect(result.map((e) => [e.billed_hours, e.billed_amount])).toEqual([['1.25', '100.00'], ['0.50', '47.50']]);
  });

  test('rounds the amount of each entry to cents, like the report: 0.25 h at 33.33 is 8.33', () => {
    const [result] = withBilling([priced(7, '33.33')], up15);

    expect(result.billed_hours).toBe('0.25');
    expect(result.billed_amount).toBe('8.33');
  });

  // The Dashboard and the month summary add these up; the report adds up its entry amounts the same way
  test('the sum of the billed amounts equals the total amount of the report for the same entries', () => {
    const entries = [
      priced(7, '33.33'), priced(22, '33.33'), priced(37, '33.33'), priced(61, '33.33'),
      priced(5, '99.99'), priced(44, '99.99'), priced(91, '12.34'), priced(1, '0.07'),
    ];
    for (const rule of [up15, nearest15, up30, nearest30]) {
      const billed = withBilling(entries, rule);
      const cents = billed.reduce((sum, e) => sum + Math.round(Number(e.billed_amount) * 100), 0);

      expect(decimal(cents)).toBe(decimal(reportAmounts(withBilledHours(entries, rule)).totalCents));
    }
  });

  test('the sum of the billed hours equals the hours of the report\'s project lines', () => {
    const entries = [priced(7, '33.33'), priced(22, '33.33'), priced(37, '33.33')];
    const billed = withBilling(entries, nearest15);

    const hours = billed.reduce((sum, e) => sum + Math.round(Number(e.billed_hours) * 100), 0);

    expect(hours).toBe(reportAmounts(withBilledHours(entries, nearest15)).projects[0].hundredths);
  });

  test('a running entry and one that ends before it starts have neither billed field set', () => {
    const running = priced(10, '80.00', { end_time: null });
    const backwards = priced(10, '80.00', { start_time: '2026-09-21T12:00:00Z', end_time: '2026-09-21T11:00:00Z' });

    const result = withBilling([running, backwards], up15);

    expect(result.map((e) => [e.billed_hours, e.billed_amount])).toEqual([[null, null], [null, null]]);
    expect(result.every((e) => e.billed_rule.minutes === 15)).toBe(true);
  });

  test('an entry without a rate has no amount to bill: 0.00', () => {
    const [result] = withBilling([priced(65, undefined)], up15);

    expect(result.billed_hours).toBe('1.25');
    expect(result.billed_amount).toBe('0.00');
  });

  test('leaves the entries alone', () => {
    const entries = [priced(65, '80.00')];

    withBilling(entries, up15);

    expect(entries[0]).not.toHaveProperty('billed_hours');
    expect(entries[0]).not.toHaveProperty('billed_amount');
  });
});

// Steps of 5 and 10 minutes are not whole hundredths of an hour, so the billed hours are the step count converted and
// printed with two decimals; the rounding itself (the number of steps) must still be exact.
describe('billedHours for the steps of 5 and 10 minutes', () => {
  test.each([[up5, 5], [nearest5, 5], [up10, 10], [nearest10, 10]])('rounds to a whole number of %j steps (%s minutes)', (rule, step) => {
    for (let minutes = 1; minutes <= 600; minutes++) {
      const rounded = Number(billedHours(entry(minutes), rule));
      // the printed hours are the exact step count x step / 60, rounded to two decimals
      const steps = Math.round((rounded * 60) / step);
      expect(rounded).toBe(Number(((steps * step) / 60).toFixed(2)));
      expect(steps).toBeGreaterThanOrEqual(1);
    }
  });

  test('up never gives less than the exact time, apart from the printing to two decimals', () => {
    for (let minutes = 1; minutes <= 300; minutes++) {
      expect(Number(billedHours(entry(minutes), up5)) * 60).toBeGreaterThanOrEqual(minutes - 0.3);
      expect(Number(billedHours(entry(minutes), up10)) * 60).toBeGreaterThanOrEqual(minutes - 0.6);
    }
  });
});

describe('withBilling for the steps of 5, 10 and 60 minutes', () => {
  const priced = (minutes, rate) => ({ project_id: 1, project_name: 'Web', hourly_rate: rate, ...entry(minutes) });

  test('the amount counts the printed hours: 7 minutes up to 5 minutes is 0.17 h, so 0.17 x 33.33 is 5.67', () => {
    const [result] = withBilling([priced(7, '33.33')], up5);

    expect(result.billed_hours).toBe('0.17');
    expect(result.billed_amount).toBe('5.67');
  });

  test('10 minutes at 33.33: 0.17 h gives 5.67, and a full hour step gives the rate', () => {
    expect(withBilling([priced(3, '33.33')], up10)[0]).toMatchObject({ billed_hours: '0.17', billed_amount: '5.67' });
    expect(withBilling([priced(3, '33.33')], up60)[0]).toMatchObject({ billed_hours: '1.00', billed_amount: '33.33' });
  });

  test('the sum of the billed amounts and hours equals the report totals for the same entries, for every new rule', () => {
    const entries = [
      priced(7, '33.33'), priced(22, '33.33'), priced(37, '33.33'), priced(61, '33.33'),
      priced(5, '99.99'), priced(44, '99.99'), priced(91, '12.34'), priced(1, '0.07'),
    ];
    for (const rule of [up5, nearest5, up10, nearest10, up60, nearest60]) {
      const billed = withBilling(entries, rule);
      const cents = billed.reduce((sum, e) => sum + Math.round(Number(e.billed_amount) * 100), 0);
      const hundredths = billed.reduce((sum, e) => sum + Math.round(Number(e.billed_hours) * 100), 0);
      const report = reportAmounts(withBilledHours(entries, rule));

      expect([rule, decimal(cents)]).toEqual([rule, decimal(report.totalCents)]);
      expect([rule, hundredths]).toEqual([rule, report.projects[0].hundredths]);
    }
  });

  test('every printed row equals printed hours x rate to the cent, also with hours like 0.08 and 0.17', () => {
    const entries = [priced(1, '33.33'), priced(6, '33.33'), priced(11, '80.00'), priced(66, '99.99')];

    for (const e of withBilling(entries, up5)) {
      expect(Math.round(Number(e.billed_hours) * Number(e.hourly_rate) * 100)).toBeCloseTo(Number(e.billed_amount) * 100, 5);
    }
  });
});

describe('the rule of a customer', () => {
  const global = { minutes: 15, direction: 'up' };

  test.each([
    [null, null, global, global],
    [undefined, undefined, global, global],
    [null, null, null, null],
    [30, 'nearest', global, { minutes: 30, direction: 'nearest' }],
    [30, 'nearest', null, { minutes: 30, direction: 'nearest' }],
    [5, 'up', global, { minutes: 5, direction: 'up' }],
    [0, 'up', global, null],
    [0, 'up', null, null],
  ])('columns %s/%s with the global rule %j give %j', (minutes, direction, globalRule, expected) => {
    expect(ruleOfCustomer({ rounding_minutes: minutes, rounding_direction: direction }, globalRule)).toEqual(expected);
    expect(ruleOfEntry({ customer_rounding_minutes: minutes, customer_rounding_direction: direction }, globalRule)).toEqual(expected);
  });

  test('an entry or a customer without the columns uses the global rule', () => {
    expect(ruleOfEntry({ id: 1 }, global)).toEqual(global);
    expect(ruleOfCustomer({ id: 1 }, global)).toEqual(global);
    expect(ruleOfCustomer(undefined, global)).toEqual(global);
  });
});

describe('entries of customers with their own rules', () => {
  // 65 minutes at 80.00; the customer columns come from the entry queries (models/TimeEntry.js)
  const of = (customer, minutes, direction, extra = {}) => ({
    ...entry(65), project_id: 1, project_name: 'Web', hourly_rate: '80.00', customer_id: customer,
    customer_rounding_minutes: minutes, customer_rounding_direction: direction, ...extra,
  });
  const global = { minutes: 15, direction: 'up' };

  test('each entry is rounded by the rule of its own customer', () => {
    const result = withBilling([of(1, null, null), of(2, 60, 'up'), of(3, 5, 'nearest'), of(4, 0, 'up')], global);

    expect(result.map((e) => e.billed_hours)).toEqual(['1.25', '2.00', '1.08', null]);
    expect(result.map((e) => e.billed_amount)).toEqual(['100.00', '160.00', '86.40', null]);
    expect(result.map((e) => e.billed_rule)).toEqual([global, { minutes: 60, direction: 'up' }, { minutes: 5, direction: 'nearest' }, null]);
  });

  test('a customer with an own rule is rounded although the global setting is off', () => {
    const result = withBilling([of(1, null, null), of(2, 30, 'up')], null);

    expect(result.map((e) => e.billed_hours)).toEqual([null, '1.50']);
    expect(result.map((e) => e.billed_rule)).toEqual([null, { minutes: 30, direction: 'up' }]);
  });

  test('a customer set to no rounding stays exact although the global setting rounds', () => {
    const [result] = withBilledHours([of(1, 0, 'up')], global);

    expect(result.billed_hours).toBeNull();
  });

  test('without a rule anywhere the entries are returned as they are', () => {
    const entries = [of(1, null, null), of(2, null, null)];

    expect(withBilling(entries, null)).toBe(entries);
    expect(withBilledHours(entries, null)).toBe(entries);
  });

  test('a running entry of a customer with an own rule is not billed, but carries the rule', () => {
    const [result] = withBilling([of(1, 30, 'up', { end_time: null })], null);

    expect(result.billed_hours).toBeNull();
    expect(result.billed_rule).toEqual({ minutes: 30, direction: 'up' });
  });

  test('the sum of the billed amounts equals the report total of each customer', () => {
    const entries = [of(1, 15, 'up'), of(1, 15, 'up', { id: 2 }), of(2, 5, 'nearest'), of(2, 5, 'nearest', { id: 3 })];
    const billed = withBilling(entries, null);

    for (const customer of [1, 2]) {
      const own = entries.filter((e) => e.customer_id === customer);
      const cents = billed.filter((e) => e.customer_id === customer).reduce((sum, e) => sum + Math.round(Number(e.billed_amount) * 100), 0);

      expect(decimal(cents)).toBe(decimal(reportAmounts(withBilledHours(own, null)).totalCents));
    }
  });

  test('entries without the customer columns next to entries with them: the global rule for the first, the own one for the others', () => {
    const bare = { ...entry(65), project_id: 1, hourly_rate: '80.00' };
    const result = withBilling([bare, of(2, 60, 'up')], global);

    expect(result.map((e) => e.billed_hours)).toEqual(['1.25', '2.00']);
    expect(result.map((e) => e.billed_rule)).toEqual([global, { minutes: 60, direction: 'up' }]);
  });

  test('only the entries without an own rule stay exact when there is no global rule', () => {
    const result = withBilledHours([of(1, null, null), of(2, 15, 'up')], null);

    expect(result.map((e) => e.billed_hours)).toEqual([null, '1.25']);
  });

  test('a customer set to no rounding alone and no global rule: the entries come back as they are', () => {
    const entries = [of(1, 0, 'up')];

    // "no rounding" is a rule of its own (0), so the entries get billed_hours null; the answer must not break
    expect(withBilledHours(entries, null).map((e) => e.billed_hours)).toEqual([null]);
  });
});
