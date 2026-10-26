const { reportAmounts, formatMoney, decimal, rateCentsOf, CURRENCY } = require('../src/utils/amounts');
const { calculateHours } = require('../src/utils/hours');
const { activateLocale } = require('../src/i18n');

const entry = (minutes, rate, overrides = {}) => ({
  project_id: 1,
  project_name: 'Website',
  hourly_rate: rate,
  start_time: '2026-03-02T08:00:00Z',
  end_time: new Date(Date.parse('2026-03-02T08:00:00Z') + minutes * 60000).toISOString(),
  ...overrides,
});

describe('reportAmounts', () => {
  test('multiplies the printed hours with the rate', () => {
    const { entryCents, totalCents } = reportAmounts([entry(90, '80.00')]);

    expect(entryCents).toEqual([12000]);
    expect(totalCents).toBe(12000);
  });

  test('rounds the hours to hundredths first: 20 minutes at 33.33 per hour is 0.33 h = 11.00', () => {
    const { entryCents } = reportAmounts([entry(20, '33.33')]);

    expect(calculateHours('2026-03-02T08:00:00Z', entry(20).end_time)).toBe('0.33');
    expect(entryCents).toEqual([1100]);
  });

  test('adds up rounded entry amounts, which differs from rounding the sum', () => {
    // 7 min = 0.12 h and 13 min = 0.22 h at 99.99: 11.9988 -> 12.00 and 21.9978 -> 22.00
    const rounded = reportAmounts([entry(7, '99.99'), entry(13, '99.99')]);
    expect(rounded.entryCents).toEqual([1200, 2200]);
    expect(rounded.totalCents).toBe(3400);

    // 0.01 h at 0.50 per hour is half a cent and rounds up to 1 cent each, so two entries give 2 cents, while one entry of 0.02 h gives 1
    const halves = reportAmounts([entry(0.6, '0.50'), entry(0.6, '0.50')]);
    expect(halves.entryCents).toEqual([1, 1]);
    expect(halves.totalCents).toBe(2);
    expect(reportAmounts([entry(1.2, '0.50')]).totalCents).toBe(1);
  });

  test('every project amount is the sum of its entries and the total the sum of the projects', () => {
    const entries = [entry(7, '99.99'), entry(13, '99.99'), entry(20, '33.33', { project_id: 2, project_name: 'App' }), entry(45, '0.00', { project_id: 3, project_name: 'Free' })];

    const { entryCents, projects, totalCents } = reportAmounts(entries);

    expect(projects.map((p) => p.cents)).toEqual([3400, 1100, 0]);
    expect(projects.reduce((sum, p) => sum + p.cents, 0)).toBe(totalCents);
    expect(entryCents.reduce((sum, c) => sum + c, 0)).toBe(totalCents);
  });

  test('keeps the projects in the order of their first entry and sums their rounded hours', () => {
    const entries = [entry(20, '10', { project_id: 2, project_name: 'B' }), entry(60, '10', { project_id: 1, project_name: 'A' }), entry(20, '10', { project_id: 2, project_name: 'B' })];

    const { projects } = reportAmounts(entries);

    expect(projects.map((p) => [p.projectId, p.name, p.hundredths, p.rateCents])).toEqual([[2, 'B', 66, 1000], [1, 'A', 100, 1000]]);
  });

  test('shows a project with rate 0 with an amount of 0', () => {
    const { projects, totalCents } = reportAmounts([entry(60, '0.00')]);

    expect(projects).toHaveLength(1);
    expect(projects[0].cents).toBe(0);
    expect(totalCents).toBe(0);
  });

  test('counts a running entry as 0 hours and 0 amount but keeps its row', () => {
    const { entryCents, projects } = reportAmounts([entry(60, '80.00'), entry(0, '80.00', { end_time: null })]);

    expect(entryCents).toEqual([8000, 0]);
    expect(projects[0].hundredths).toBe(100);
  });

  test('handles more than 1000 hours without drifting', () => {
    const entries = Array.from({ length: 1100 }, () => entry(60, '80.00'));

    const { totalCents, projects } = reportAmounts(entries);

    expect(projects[0].hundredths).toBe(110000);
    expect(totalCents).toBe(8800000);
  });

  test.each([[undefined], [null], ['abc'], ['-5.00'], ['']])('treats the rate %p as 0', (rate) => {
    expect(rateCentsOf({ hourly_rate: rate })).toBe(0);
    expect(reportAmounts([entry(60, rate)]).totalCents).toBe(0);
  });

  test('reads the DECIMAL(10,2) rate string exactly', () => {
    expect(rateCentsOf({ hourly_rate: '33.33' })).toBe(3333);
    expect(rateCentsOf({ hourly_rate: '1234567.89' })).toBe(123456789);
  });

  test('has nothing for no entries', () => {
    expect(reportAmounts([])).toEqual({ entryCents: [], projects: [], totalCents: 0 });
  });

  test('tells projects apart by id, and falls back to the name without an id', () => {
    const same = reportAmounts([entry(60, '10', { project_id: 1 }), entry(60, '10', { project_id: 2 })]);
    expect(same.projects).toHaveLength(2);
    const byName = reportAmounts([entry(60, '10', { project_id: undefined }), entry(60, '10', { project_id: undefined })]);
    expect(byName.projects).toHaveLength(1);
  });
});

describe('formatMoney and decimal', () => {
  test('formats euro cents in the language', () => {
    activateLocale('de');
    expect(formatMoney(22250).replace(/\s/g, ' ')).toBe('222,50 €');
    expect(formatMoney(0).replace(/\s/g, ' ')).toBe('0,00 €');
    expect(formatMoney(123456789).replace(/\s/g, ' ')).toBe('1.234.567,89 €');
    activateLocale('en');
    expect(formatMoney(22250)).toBe('€222.50');
  });

  test('writes two decimals for the JSON', () => {
    expect(decimal(22250)).toBe('222.50');
    expect(decimal(0)).toBe('0.00');
    expect(CURRENCY).toBe('EUR');
  });
});

describe('reportAmounts edge cases', () => {
  const seconds = (count, rate, overrides) => entry(count / 60, rate, overrides);
  const totalOf = (list) => reportAmounts(list).totalCents;

  test.each([
    // [minutes, rate, cents]: the hours are rounded to hundredths first, then the amount to cents (half up)
    [0.6, '0.50', 1], // 0.01 h x 0.50 = 0.5 cent
    [0.6, '0.49', 0], // 0.49 cent
    [9, '33.33', 500], // 0.15 h x 33.33 = 4.9995 -> 5.00
    [30, '0.01', 1], // 0.50 h x 0.01 = 0.5 cent
    [0.3, '99.99', 100], // 0.3 min is 0.005 h, printed as 0.01 (toFixed): 0.01 x 99.99 = 1.00
  ])('%p minutes at %p is %p cents', (minutes, rate, cents) => {
    expect(totalOf([entry(minutes, rate)])).toBe(cents);
  });

  test('the cents match exact integer maths for many hours and rates (no float drift)', () => {
    for (let hundredths = 1; hundredths <= 2500; hundredths += 7) {
      for (const rateCents of [1, 5, 50, 333, 3333, 9999, 12345, 100000, 123456789]) {
        const rate = (rateCents / 100).toFixed(2);
        const exact = Number((BigInt(hundredths) * BigInt(rateCents) * 2n + 100n) / 200n);

        expect(totalOf([entry(hundredths * 0.6, rate)])).toBe(exact);
      }
    }
  });

  test('the hours of a project are exactly the printed hours of its entries, whatever the seconds', () => {
    for (let second = 0; second < 40000; second += 37) {
      const item = seconds(second, '1');
      const [project] = reportAmounts([item]).projects;

      expect(decimal(project.hundredths)).toBe(calculateHours(item.start_time, item.end_time));
    }
  });

  test('prints cents as exact two-decimal strings', () => {
    for (let cents = 0; cents <= 300000; cents += 101) {
      expect(decimal(cents)).toBe(`${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`);
    }
    expect(decimal(140310)).toBe('1403.10');
  });

  test('takes a rate as number or string, and ignores a rate that is not a plain number', () => {
    expect(rateCentsOf({ hourly_rate: 80.5 })).toBe(8050);
    expect(rateCentsOf({ hourly_rate: '0.00' })).toBe(0);
    expect(rateCentsOf({ hourly_rate: 'Infinity' })).toBe(0);
    expect(rateCentsOf({ hourly_rate: '  ' })).toBe(0);
  });

  test('keeps projects with the same name apart when their ids differ', () => {
    const { projects } = reportAmounts([entry(60, '10', { project_id: 1 }), entry(60, '20', { project_id: 2 })]);

    expect(projects.map((p) => [p.projectId, p.name, p.rateCents, p.cents])).toEqual([[1, 'Website', 1000, 1000], [2, 'Website', 2000, 2000]]);
  });

  test('lists a project with a rate and no hours (running entry only) with amount 0, and one with hours and rate 0', () => {
    const { projects, totalCents } = reportAmounts([
      entry(0, '80.00', { project_id: 1, end_time: null }),
      entry(60, '0.00', { project_id: 2, project_name: 'Free' }),
    ]);

    expect(projects.map((p) => [p.hundredths, p.rateCents, p.cents])).toEqual([[0, 8000, 0], [100, 0, 0]]);
    expect(totalCents).toBe(0);
  });

  test('adds up hundreds of projects in the order they first appear', () => {
    const list = Array.from({ length: 300 }, (_, i) => entry(30, '10', { project_id: 300 - i, project_name: `P${i}` }));

    const { projects, totalCents } = reportAmounts(list);

    expect(projects.map((p) => p.projectId)).toEqual(list.map((e) => e.project_id));
    expect(totalCents).toBe(300 * 500);
  });

  test('handles 9999.99 hours at the highest rate the database allows', () => {
    const { totalCents } = reportAmounts([entry(9999.99 * 60, '99999999.99')]);

    // 999999 x 9999999999 / 100 cents, exactly (the product is above 2^53; the result is still right here)
    expect(totalCents).toBe(Number((999999n * 9999999999n * 2n + 100n) / 200n));
  });

  test('prints the German and English money format with a grouping separator', () => {
    activateLocale('de');
    expect(formatMoney(140310)).toBe('1.403,10\u00a0€');
    activateLocale('en');
    expect(formatMoney(140310)).toBe('€1,403.10');
  });

  // The stop uses the browser clock, so a clock that runs behind the server's start time gives such an entry
  test('never gives an entry with its end before its start a negative amount', () => {
    const { entryCents, totalCents } = reportAmounts([entry(-60, '80.00'), entry(60, '80.00')]);

    expect(entryCents).toEqual([0, 8000]);
    expect(totalCents).toBe(8000);
  });

  test('counts such an entry as 0 hours in its project, next to a normal one', () => {
    const { projects, totalCents } = reportAmounts([entry(-60, '80.00'), entry(90, '80.00')]);

    expect(projects).toHaveLength(1);
    expect(projects[0]).toEqual(expect.objectContaining({ hundredths: 150, cents: 12000 }));
    expect(totalCents).toBe(12000);
  });

  test('a project with only such an entry has 0 hours and 0 amount', () => {
    const { projects, totalCents } = reportAmounts([entry(-60, '80.00')]);

    expect(projects[0]).toEqual(expect.objectContaining({ hundredths: 0, cents: 0 }));
    expect(totalCents).toBe(0);
  });

  test('counts an invalid start or end as 0 hours and 0 amount, never NaN', () => {
    const { entryCents, projects, totalCents } = reportAmounts([entry(60, '80.00', { end_time: 'not a date' }), entry(60, '80.00', { start_time: 'x' })]);

    expect(entryCents).toEqual([0, 0]);
    expect(projects[0].hundredths).toBe(0);
    expect(totalCents).toBe(0);
  });

  test('an entry that ends a few seconds before its start rounds to 0 hours and 0 cents', () => {
    expect(totalOf([seconds(-10, '80.00')])).toBe(0);
  });
});
