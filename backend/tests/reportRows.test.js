const { reportRows, formatDecimal } = require('../src/utils/reportRows');
const { activateLocale } = require('../src/i18n');

const entry = (overrides) => ({
  start_time: '2026-09-21T08:00:00Z',
  end_time: '2026-09-21T09:30:00Z',
  project_name: 'Website',
  description: 'Konzept',
  ...overrides,
});
const options = { customerName: 'Muster GmbH', locale: 'en', timeZone: 'UTC' };

describe('reportRows', () => {
  test('has the columns date, start, end, customer, project, description and hours', () => {
    expect(reportRows([], options).headers).toEqual(['Date', 'Start', 'End', 'Customer', 'Project', 'Description', 'Hours']);
    expect(reportRows([], { ...options, locale: 'de' }).headers).toEqual(['Datum', 'Beginn', 'Ende', 'Kunde', 'Projekt', 'Beschreibung', 'Stunden']);
  });

  test('turns an entry into typed cells', () => {
    const { rows } = reportRows([entry()], options);

    expect(rows).toEqual([[
      { text: '2026-09-21' }, { text: '08:00' }, { text: '09:30' }, { text: 'Muster GmbH' },
      { text: 'Website' }, { text: 'Konzept' }, { number: '1.50' },
    ]]);
  });

  test('shows the billed hours when the hours are rounded, and the exact times', () => {
    const { rows } = reportRows([entry({ billed_hours: '1.75' })], options);

    expect(rows[0]).toEqual([
      { text: '2026-09-21' }, { text: '08:00' }, { text: '09:30' }, { text: 'Muster GmbH' },
      { text: 'Website' }, { text: 'Konzept' }, { number: '1.75' },
    ]);
  });

  test('shows the billed hours in German with a decimal comma', () => {
    const { rows } = reportRows([entry({ billed_hours: '0.25' })], { ...options, locale: 'de' });

    expect(rows[0].at(-1)).toEqual({ number: '0,25' });
  });

  test('keeps the order of the entries', () => {
    const { rows } = reportRows([entry({ project_name: 'B' }), entry({ project_name: 'A' })], options);

    expect(rows.map((row) => row[4].text)).toEqual(['B', 'A']);
  });

  test('writes the hours with the decimal separator of the language and no unit', () => {
    expect(reportRows([entry()], { ...options, locale: 'de' }).rows[0][6]).toEqual({ number: '1,50' });
    expect(reportRows([entry()], { ...options, locale: 'en' }).rows[0][6]).toEqual({ number: '1.50' });
  });

  test('falls back to German for an unknown or missing language', () => {
    expect(reportRows([entry()], { ...options, locale: undefined }).rows[0][6]).toEqual({ number: '1,50' });
  });

  test('rounds the hours to two decimals', () => {
    const { rows } = reportRows([entry({ end_time: '2026-09-21T08:20:00Z' })], options);

    expect(rows[0][6]).toEqual({ number: '0.33' });
  });

  test.each([
    // [end, English, German]: the CSV keeps decimal hours, each the entry's whole minutes / 60
    ['2026-09-21T08:05:00Z', '0.08', '0,08'],
    ['2026-09-21T09:05:00Z', '1.08', '1,08'],
    ['2026-09-21T08:29:29Z', '0.48', '0,48'], // 29 seconds are dropped: 29 min
    ['2026-09-21T08:29:30Z', '0.50', '0,50'], // 30 seconds count as a minute: 30 min
  ])('writes %s as decimal hours of whole minutes: %s / %s', (end_time, english, german) => {
    expect(reportRows([entry({ end_time })], options).rows[0][6]).toEqual({ number: english });
    expect(reportRows([entry({ end_time })], { ...options, locale: 'de' }).rows[0][6]).toEqual({ number: german });
  });

  test('keeps a negative duration of an entry that ends before it starts', () => {
    const { rows } = reportRows([entry({ end_time: '2026-09-21T07:00:00Z' })], options);

    expect(rows[0][6]).toEqual({ number: '-1.00' });
  });

  test('shows a running entry with an empty end and 0 hours', () => {
    const { rows } = reportRows([entry({ end_time: null })], options);

    expect(rows[0][2]).toEqual({ text: '' });
    expect(rows[0][6]).toEqual({ number: '0.00' });
  });

  test('writes an empty description and a missing one as empty text', () => {
    const { rows } = reportRows([entry({ description: null }), entry({ description: '' })], options);

    expect(rows.map((row) => row[5])).toEqual([{ text: '' }, { text: '' }]);
  });

  test('shows date and times in the time zone', () => {
    const { rows } = reportRows([entry({ start_time: '2026-09-30T22:30:00Z', end_time: '2026-09-30T23:15:00Z' })], { ...options, timeZone: 'Europe/Berlin' });

    expect(rows[0].slice(0, 3)).toEqual([{ text: '2026-10-01' }, { text: '00:30' }, { text: '01:15' }]);
  });

  test('puts an entry at 00:30 on the 1st on that date in the time zone, and on the day before in UTC', () => {
    const start = '2026-10-01T00:30:00+02:00';

    expect(reportRows([entry({ start_time: start })], { ...options, timeZone: 'Europe/Berlin' }).rows[0][0]).toEqual({ text: '2026-10-01' });
    expect(reportRows([entry({ start_time: start })], options).rows[0][0]).toEqual({ text: '2026-09-30' });
  });

  test('shows midnight as 00:00, not 24:00', () => {
    const { rows } = reportRows([entry({ start_time: '2026-09-21T00:00:00Z' })], options);

    expect(rows[0][1]).toEqual({ text: '00:00' });
  });

  test('accepts Date objects as read from the database', () => {
    const { rows } = reportRows([entry({ start_time: new Date('2026-09-21T08:00:00Z'), end_time: new Date('2026-09-21T09:00:00Z') })], options);

    expect(rows[0].slice(0, 3)).toEqual([{ text: '2026-09-21' }, { text: '08:00' }, { text: '09:00' }]);
    expect(rows[0][6]).toEqual({ number: '1.00' });
  });
});

describe('formatDecimal', () => {
  test('formatDecimal follows the active language', () => {
    activateLocale('de');
    expect(formatDecimal('1234.5')).toBe('1.234,50');
    activateLocale('en');
    expect(formatDecimal('1234.5')).toBe('1,234.50');
  });
});

describe('reportRows with amounts', () => {
  const priced = (overrides) => entry({ hourly_rate: '33.33', project_id: 1, ...overrides });

  test('adds the columns Rate (EUR/h) and Amount (EUR) after the hours', () => {
    expect(reportRows([], { ...options, amounts: true }).headers).toEqual(
      ['Date', 'Start', 'End', 'Customer', 'Project', 'Description', 'Hours', 'Rate (EUR/h)', 'Amount (EUR)']
    );
    expect(reportRows([], { ...options, locale: 'de', amounts: true }).headers.slice(-3)).toEqual(['Stunden', 'Stundensatz (EUR/h)', 'Betrag (EUR)']);
  });

  test('writes the rate and the amount of printed hours x printed rate as number cells', () => {
    // 20 minutes are printed as 0.33 h; the amount is 20 min x 33.33 / 60 = 11.11
    const { rows } = reportRows([priced({ end_time: '2026-09-21T08:20:00Z' })], { ...options, amounts: true });

    expect(rows[0].slice(6)).toEqual([{ number: '0.33' }, { number: '33.33' }, { number: '11.11' }]);
  });

  test('1:05 h at 95.00 per hour is 102.92 with 1.08 hours', () => {
    const { rows } = reportRows([priced({ hourly_rate: '95.00', end_time: '2026-09-21T09:05:00Z' })], { ...options, amounts: true });

    expect(rows[0].slice(6)).toEqual([{ number: '1.08' }, { number: '95.00' }, { number: '102.92' }]);
  });

  test('an entry that ends before it starts keeps its negative hours and has amount 0', () => {
    const { rows } = reportRows([priced({ end_time: '2026-09-21T07:00:00Z' })], { ...options, amounts: true });

    expect(rows[0].slice(6)).toEqual([{ number: '-1.00' }, { number: '33.33' }, { number: '0.00' }]);
  });

  test('uses the decimal comma in German', () => {
    const { rows } = reportRows([priced({ hourly_rate: '80.00' })], { ...options, locale: 'de', amounts: true });

    expect(rows[0].slice(6)).toEqual([{ number: '1,50' }, { number: '80,00' }, { number: '120,00' }]);
  });

  test('shows a running entry and a rate of 0 with 0,00 amounts', () => {
    const { rows } = reportRows([priced({ end_time: null }), priced({ hourly_rate: '0.00' })], { ...options, amounts: true });

    expect(rows[0].slice(6)).toEqual([{ number: '0.00' }, { number: '33.33' }, { number: '0.00' }]);
    expect(rows[1].slice(6)).toEqual([{ number: '1.50' }, { number: '0.00' }, { number: '0.00' }]);
  });

  test('has no extra columns without the flag, or with it off', () => {
    const plain = reportRows([priced()], options);

    expect(reportRows([priced()], { ...options, amounts: false })).toEqual(plain);
    expect(plain.headers).toHaveLength(7);
    expect(plain.rows[0]).toHaveLength(7);
  });
});

describe('reportRows grouped by task', () => {
  const grouped = (overrides) => entry({ task: 'Fix login', details: ['review', 'redirect'], count: 2, ...overrides });
  const options = { customerName: 'Muster GmbH', locale: 'en', timeZone: 'UTC', grouped: true };

  test('leaves out Start and End and adds Task after Project', () => {
    expect(reportRows([], options).headers).toEqual(['Date', 'Customer', 'Project', 'Task', 'Description', 'Hours']);
    expect(reportRows([], { ...options, locale: 'de' }).headers).toEqual(['Datum', 'Kunde', 'Projekt', 'Aufgabe', 'Beschreibung', 'Stunden']);
  });

  test('writes the task and the details joined by semicolons', () => {
    const { rows } = reportRows([grouped()], options);

    expect(rows[0]).toEqual([
      { text: '2026-09-21' }, { text: 'Muster GmbH' }, { text: 'Website' }, { text: 'Fix login' },
      { text: 'review; redirect' }, { number: '1.50' },
    ]);
  });

  test('an entry without a task has an empty task cell and its own description', () => {
    const { rows } = reportRows([entry({ task: null })], options);

    expect(rows[0].slice(3, 5)).toEqual([{ text: '' }, { text: 'Konzept' }]);
  });

  test('a group without details has an empty description', () => {
    expect(reportRows([grouped({ details: [] })], options).rows[0][4]).toEqual({ text: '' });
  });

  test('a running entry with a task keeps the task, an empty description and 0 hours', () => {
    const { rows } = reportRows([entry({ task: 'Fix login', description: null, end_time: null })], options);

    expect(rows[0].slice(3)).toEqual([{ text: 'Fix login' }, { text: '' }, { number: '0.00' }]);
  });

  test('the amounts view adds Rate and Amount after the hours, from the summed minutes', () => {
    const priced = grouped({ hourly_rate: '80.00', project_id: 1 });
    const { headers, rows } = reportRows([priced], { ...options, amounts: true });

    expect(headers.slice(-3)).toEqual(['Hours', 'Rate (EUR/h)', 'Amount (EUR)']);
    expect(rows[0].slice(5)).toEqual([{ number: '1.50' }, { number: '80.00' }, { number: '120.00' }]);
  });

  test('the amounts view uses the billed hours of a rounded group', () => {
    const priced = grouped({ hourly_rate: '80.00', project_id: 1, billed_hours: '1.75' });

    expect(reportRows([priced], { ...options, amounts: true }).rows[0].slice(5)).toEqual([{ number: '1.75' }, { number: '80.00' }, { number: '140.00' }]);
  });
});
