const { reportAmounts, formatMoney, decimal, rateCentsOf, CURRENCY } = require('../src/utils/amounts');
const { reportMinutes, formatDuration } = require('../src/utils/hours');
const { activateLocale } = require('../src/i18n');

const entry = (minutes, rate, overrides = {}) => ({
  project_id: 1,
  project_name: 'Website',
  hourly_rate: rate,
  start_time: '2026-03-02T08:00:00Z',
  end_time: new Date(Date.parse('2026-03-02T08:00:00Z') + minutes * 60000).toISOString(),
  ...overrides,
});

describe('reportAmounts with rounded hours (billed_hours)', () => {
  test('counts the billed time, not the exact one: 65 minutes billed as 1:15 h at 80.00 is 100.00', () => {
    const { entryCents, projects, totalCents } = reportAmounts([entry(65, '80.00', { billed_hours: '1.25' })]);

    expect(entryCents).toEqual([10000]);
    expect(projects[0]).toMatchObject({ minutes: 75, cents: 10000 });
    expect(totalCents).toBe(10000);
  });

  test('minutes x rate equals the amount on every row and the project and total add up', () => {
    const entries = [entry(65, '33.33', { billed_hours: '1.25' }), entry(20, '33.33', { billed_hours: '0.50' })];

    const { entryCents, projects, totalCents } = reportAmounts(entries);

    // 75 min x 33.33 / 60 = 41.6625 and 30 min x 33.33 / 60 = 16.665
    expect(entryCents).toEqual([4166, 1667]);
    expect(projects[0].minutes).toBe(105);
    expect(totalCents).toBe(entryCents[0] + entryCents[1]);
    expect(projects[0].cents).toBe(totalCents);
  });

  test('an entry without billed_hours is counted exactly as before', () => {
    expect(reportAmounts([entry(90, '80.00')]).entryCents).toEqual([12000]);
    expect(reportAmounts([entry(90, '80.00', { billed_hours: null })]).entryCents).toEqual([12000]);
  });

  test('a running entry and one that ends before it starts have no amount, with or without a rule', () => {
    const running = entry(0, '80.00', { end_time: null, billed_hours: null });
    const backwards = entry(0, '80.00', { start_time: '2026-03-02T12:00:00Z', end_time: '2026-03-02T11:00:00Z', billed_hours: null });

    expect(reportAmounts([running, backwards]).entryCents).toEqual([0, 0]);
  });
});

describe('reportAmounts', () => {
  test('multiplies the printed time with the rate', () => {
    const { entryCents, totalCents } = reportAmounts([entry(90, '80.00')]);

    expect(entryCents).toEqual([12000]);
    expect(totalCents).toBe(12000);
  });

  test('multiplies the whole minutes, not hours rounded to hundredths: 20 minutes at 33.33 per hour is 11.11', () => {
    const { entryCents } = reportAmounts([entry(20, '33.33')]);

    expect(entryCents).toEqual([1111]);
  });

  // The frontend's summarize (tests/summary.test.js, "each entry is rounded to cents") uses the same entries and must give the same total
  test('the Dashboard and the report agree: 65 min at 95.00, 20 at 33.33, and 7 and 13 at 99.99 give 147.36', () => {
    const { entryCents, totalCents } = reportAmounts([
      entry(65, '95.00', { project_id: 7 }), entry(20, '33.33', { project_id: 10 }), entry(7, '99.99', { project_id: 11 }), entry(13, '99.99', { project_id: 11 }),
    ]);

    expect(entryCents).toEqual([10292, 1111, 1167, 2166]);
    expect(totalCents).toBe(14736);
  });

  test('the case of the issue: 1:05 h at 95.00 per hour is 102.92, not 102.60', () => {
    const { entryCents, totalCents, projects } = reportAmounts([entry(65, '95.00')]);

    expect(entryCents).toEqual([10292]);
    expect(totalCents).toBe(10292);
    expect(projects[0].minutes).toBe(65);
  });

  test('adds up rounded entry amounts, which differs from rounding the sum', () => {
    // 7 min at 99.99 is 11.6655 -> 11.67 and 13 min is 21.6645 -> 21.66
    const rounded = reportAmounts([entry(7, '99.99'), entry(13, '99.99')]);
    expect(rounded.entryCents).toEqual([1167, 2166]);
    expect(rounded.totalCents).toBe(3333);

    // 3 min at 0.50 per hour is 2.5 cents and rounds up to 3 cents each, so two entries give 6 cents, while one entry of 6 min gives 5
    const halves = reportAmounts([entry(3, '0.50'), entry(3, '0.50')]);
    expect(halves.entryCents).toEqual([3, 3]);
    expect(halves.totalCents).toBe(6);
    expect(reportAmounts([entry(6, '0.50')]).totalCents).toBe(5);
  });

  test('every project amount is the sum of its entries and the total the sum of the projects', () => {
    const entries = [entry(7, '99.99'), entry(13, '99.99'), entry(20, '33.33', { project_id: 2, project_name: 'App' }), entry(45, '0.00', { project_id: 3, project_name: 'Free' })];

    const { entryCents, projects, totalCents } = reportAmounts(entries);

    expect(projects.map((p) => p.cents)).toEqual([3333, 1111, 0]);
    expect(projects.reduce((sum, p) => sum + p.cents, 0)).toBe(totalCents);
    expect(entryCents.reduce((sum, c) => sum + c, 0)).toBe(totalCents);
  });

  test('keeps the projects in the order of their first entry and sums their minutes', () => {
    const entries = [entry(20, '10', { project_id: 2, project_name: 'B' }), entry(60, '10', { project_id: 1, project_name: 'A' }), entry(20, '10', { project_id: 2, project_name: 'B' })];

    const { projects } = reportAmounts(entries);

    expect(projects.map((p) => [p.projectId, p.name, p.minutes, p.rateCents])).toEqual([[2, 'B', 40, 1000], [1, 'A', 60, 1000]]);
  });

  test('shows a project with rate 0 with an amount of 0', () => {
    const { projects, totalCents } = reportAmounts([entry(60, '0.00')]);

    expect(projects).toHaveLength(1);
    expect(projects[0].cents).toBe(0);
    expect(totalCents).toBe(0);
  });

  test('counts a running entry as 0 minutes and 0 amount but keeps its row', () => {
    const { entryCents, projects } = reportAmounts([entry(60, '80.00'), entry(0, '80.00', { end_time: null })]);

    expect(entryCents).toEqual([8000, 0]);
    expect(projects[0].minutes).toBe(60);
  });

  test('handles more than 1000 hours without drifting', () => {
    const entries = Array.from({ length: 1100 }, () => entry(60, '80.00'));

    const { totalCents, projects } = reportAmounts(entries);

    expect(projects[0].minutes).toBe(66000);
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
    // [minutes, rate, cents]: whole minutes x rate / 60, rounded to cents (half up)
    [30, '0.01', 1], // exactly half a cent
    [1, '0.30', 1], // exactly half a cent
    [1, '0.29', 0], // 0.48 cent
    [9, '33.33', 500], // 4.9995 -> 5.00
    [1, '99.99', 167], // 1.6665 -> 1.67
  ])('%p minutes at %p is %p cents', (minutes, rate, cents) => {
    expect(totalOf([entry(minutes, rate)])).toBe(cents);
  });

  test('the cents match exact integer maths for many hours and rates (no float drift)', () => {
    for (let hundredths = 1; hundredths <= 2500; hundredths += 7) {
      for (const rateCents of [1, 5, 50, 333, 3333, 9999, 12345, 100000, 123456789]) {
        const rate = (rateCents / 100).toFixed(2);
        const exact = Number((BigInt(hundredths) * BigInt(rateCents) * 2n + 60n) / 120n);

        expect(totalOf([entry(hundredths, rate)])).toBe(exact);
      }
    }
  });

  test('the minutes of a project are exactly the printed minutes of its entry, whatever the seconds', () => {
    for (let second = 0; second < 40000; second += 37) {
      const item = seconds(second, '1');
      const [project] = reportAmounts([item]).projects;

      expect(project.minutes).toBe(reportMinutes(item));
      expect(project.minutes).toBe(Math.round(second / 60));
      expect(formatDuration(project.minutes)).toBe(formatDuration(reportMinutes(item)));
    }
  });

  test('29 seconds count as no minute and 30 seconds as one, in minutes and in the amount', () => {
    expect(reportAmounts([seconds(29, '60.00')])).toMatchObject({ entryCents: [0], projects: [{ minutes: 0 }] });
    expect(reportAmounts([seconds(30, '60.00')])).toMatchObject({ entryCents: [100], projects: [{ minutes: 1 }] });
    expect(reportAmounts([seconds(89, '60.00')]).projects[0].minutes).toBe(1);
    expect(reportAmounts([seconds(90, '60.00')]).projects[0].minutes).toBe(2);
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

    expect(projects.map((p) => [p.minutes, p.rateCents, p.cents])).toEqual([[0, 8000, 0], [60, 0, 0]]);
    expect(totalCents).toBe(0);
  });

  test('adds up hundreds of projects in the order they first appear', () => {
    const list = Array.from({ length: 300 }, (_, i) => entry(30, '10', { project_id: 300 - i, project_name: `P${i}` }));

    const { projects, totalCents } = reportAmounts(list);

    expect(projects.map((p) => p.projectId)).toEqual(list.map((e) => e.project_id));
    expect(totalCents).toBe(300 * 500);
  });

  test('handles 9999.99 hours at the highest rate the database allows', () => {
    const { totalCents } = reportAmounts([entry(599999, '99999999.99')]);

    // 599999 x 9999999999 / 60 cents, exactly
    expect(totalCents).toBe(Number((599999n * 9999999999n * 2n + 60n) / 120n));
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

  test('counts such an entry as 0 minutes in its project, next to a normal one', () => {
    const { projects, totalCents } = reportAmounts([entry(-60, '80.00'), entry(90, '80.00')]);

    expect(projects).toHaveLength(1);
    expect(projects[0]).toEqual(expect.objectContaining({ minutes: 90, cents: 12000 }));
    expect(totalCents).toBe(12000);
  });

  test('a project with only such an entry has 0 minutes and 0 amount', () => {
    const { projects, totalCents } = reportAmounts([entry(-60, '80.00')]);

    expect(projects[0]).toEqual(expect.objectContaining({ minutes: 0, cents: 0 }));
    expect(totalCents).toBe(0);
  });

  test('counts an invalid start or end as 0 minutes and 0 amount, never NaN', () => {
    const { entryCents, projects, totalCents } = reportAmounts([entry(60, '80.00', { end_time: 'not a date' }), entry(60, '80.00', { start_time: 'x' })]);

    expect(entryCents).toEqual([0, 0]);
    expect(projects[0].minutes).toBe(0);
    expect(totalCents).toBe(0);
  });

  test('an entry that ends a few seconds before its start rounds to 0 minutes and 0 cents', () => {
    expect(totalOf([seconds(-10, '80.00')])).toBe(0);
  });
});
