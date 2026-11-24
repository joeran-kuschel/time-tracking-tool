const { MAX_TASK, parseTask, taskKey, groupByTask, rowText } = require('../src/utils/tasks');

describe('parseTask', () => {
  test('leaves a task that was not sent alone', () => {
    expect(parseTask(undefined)).toEqual({ value: undefined });
  });

  test('clears the task for null, an empty text and spaces', () => {
    expect(parseTask(null)).toEqual({ value: null });
    expect(parseTask('')).toEqual({ value: null });
    expect(parseTask('   ')).toEqual({ value: null });
  });

  test('trims the text', () => {
    expect(parseTask('  Fix login ')).toEqual({ value: 'Fix login' });
  });

  test('refuses what is not text', () => {
    expect(parseTask(5)).toEqual({ error: 'task must be text' });
    expect(parseTask({})).toEqual({ error: 'task must be text' });
  });

  test('takes MAX_TASK characters and refuses more', () => {
    expect(parseTask('a'.repeat(MAX_TASK)).value).toHaveLength(MAX_TASK);
    expect(parseTask('a'.repeat(MAX_TASK + 1)).error).toMatch(/at most 100/);
  });
});

test('taskKey ignores case and surrounding spaces', () => {
  expect(taskKey('  Fix LOGIN ')).toBe(taskKey('fix login'));
});

describe('groupByTask', () => {
  let nextId = 1;
  const entry = (start, end, fields = {}) => ({
    id: nextId++, project_id: 1, project_name: 'Website', task: 'Fix login', description: null,
    start_time: new Date(`2026-11-24T${start}:00Z`), end_time: end ? new Date(`2026-11-24T${end}:00Z`) : null, ...fields,
  });
  const minutes = (row) => (new Date(row.end_time) - new Date(row.start_time)) / 60000;

  test('sums the entries of one day, project and task into one row', () => {
    const rows = groupByTask([entry('14:00', '14:10', { description: 'redirect' }), entry('09:00', '09:30', { description: 'review' }), entry('11:00', '11:20')]);

    expect(rows).toHaveLength(1);
    expect(minutes(rows[0])).toBe(60);
    expect(rows[0].start_time).toEqual(new Date('2026-11-24T09:00:00Z'));
    expect(rows[0].count).toBe(3);
    expect(rows[0].details).toEqual(['review', 'redirect']);
    expect(rows[0].entryIds).toHaveLength(3);
  });

  test('compares tasks ignoring case and spaces and keeps the first spelling', () => {
    const rows = groupByTask([entry('09:00', '09:30', { task: 'Fix login' }), entry('11:00', '11:30', { task: ' fix LOGIN ' })]);

    expect(rows).toHaveLength(1);
    expect(rows[0].task).toBe('Fix login');
  });

  test('lists identical descriptions once, whatever their case', () => {
    const rows = groupByTask([entry('09:00', '09:30', { description: 'Call' }), entry('11:00', '11:30', { description: 'call ' })]);

    expect(rows[0].details).toEqual(['Call']);
  });

  test('never groups other days, projects or tasks', () => {
    const rows = groupByTask([
      entry('09:00', '09:30'),
      entry('09:00', '09:30', { start_time: new Date('2026-11-25T09:00:00Z'), end_time: new Date('2026-11-25T09:30:00Z') }),
      entry('10:00', '10:30', { project_id: 2 }),
      entry('11:00', '11:30', { task: 'Review' }),
    ]);

    expect(rows).toHaveLength(4);
  });

  test('a day follows the time zone: 23:30 UTC and 00:30 UTC are one day in Berlin', () => {
    const late = entry('23:30', '23:50');
    const early = entry('00:30', '00:50', { start_time: new Date('2026-11-25T00:30:00Z'), end_time: new Date('2026-11-25T00:50:00Z') });

    expect(groupByTask([late, early], 'UTC')).toHaveLength(2);
    expect(groupByTask([late, early], 'Europe/Berlin')).toHaveLength(1);
  });

  test('leaves entries without a task as they are, running ones too', () => {
    const plain = entry('09:00', '09:30', { task: null });
    const runningPlain = entry('10:00', null, { task: null });

    expect(groupByTask([plain, runningPlain])).toEqual([plain, runningPlain]);
  });

  test('a single entry keeps its own end time and its id', () => {
    const only = entry('09:00', '09:45', { description: 'review' });
    const [row] = groupByTask([only]);

    expect(row.id).toBe(only.id);
    expect(row.end_time).toEqual(only.end_time);
    expect(row.count).toBe(1);
  });

  test('keeps the order of the first entry of each group', () => {
    const a = entry('09:00', '09:30', { task: 'A' });
    const b = entry('10:00', '10:30', { task: 'B' });
    const a2 = entry('11:00', '11:30', { task: 'A' });

    expect(groupByTask([a, b, a2]).map((row) => row.task)).toEqual(['A', 'B']);
  });

  test('sums seconds exactly, so no time is lost', () => {
    const rows = groupByTask([
      entry('09:00', '09:00', { end_time: new Date('2026-11-24T09:00:20Z') }),
      entry('10:00', '10:00', { end_time: new Date('2026-11-24T10:00:20Z') }),
    ]);

    expect(new Date(rows[0].end_time) - new Date(rows[0].start_time)).toBe(40000);
  });
  test('Berlin midnight is 23:00 UTC in winter and 22:00 UTC in summer, so the same two instants fall on one day in UTC and two in Berlin', () => {
    const late = (day, time) => new Date(`${day}T${time}:00Z`);
    const winter = [
      entry('00:00', null, { start_time: late('2026-01-14', '22:30'), end_time: late('2026-01-14', '22:40') }),
      entry('00:00', null, { start_time: late('2026-01-14', '23:30'), end_time: late('2026-01-14', '23:40') }),
    ];
    // 23:30 UTC on 14 January is 00:30 on 15 January in Berlin (UTC+1); in July 22:30 UTC is 00:30 (UTC+2)
    const summer = [
      entry('00:00', null, { start_time: late('2026-07-14', '21:30'), end_time: late('2026-07-14', '21:40') }),
      entry('00:00', null, { start_time: late('2026-07-14', '22:30'), end_time: late('2026-07-14', '22:40') }),
    ];

    expect(groupByTask(winter, 'Europe/Berlin')).toHaveLength(2);
    expect(groupByTask(summer, 'Europe/Berlin')).toHaveLength(2);
    expect(groupByTask(winter, 'UTC')).toHaveLength(1);
    expect(groupByTask(winter, 'America/Los_Angeles')).toHaveLength(1);
  });

  test('a day boundary of the month: 31 December 23:30 and 1 January 00:30 are two rows', () => {
    const rows = groupByTask([
      entry('00:00', null, { start_time: new Date('2026-12-31T23:30:00Z'), end_time: new Date('2026-12-31T23:50:00Z') }),
      entry('00:00', null, { start_time: new Date('2027-01-01T00:30:00Z'), end_time: new Date('2027-01-01T00:50:00Z') }),
    ]);

    expect(rows).toHaveLength(2);
  });

  test('an entry that ends before it starts counts its negative time into the sum', () => {
    const [row] = groupByTask([entry('09:00', '09:30'), entry('10:00', '09:50')]);

    // +30 minutes and -10 minutes, like the detailed report (utils/hours.js keeps negative minutes)
    expect(minutes(row)).toBe(20);
    expect(row.count).toBe(2);
  });

  test('a running entry with a task is its own row, not part of the sum, and keeps no end', () => {
    const running = entry('12:00', null, { description: 'läuft' });
    const rows = groupByTask([entry('09:00', '09:30'), running, entry('10:00', '10:30')]);

    expect(rows).toHaveLength(2);
    expect(minutes(rows[0])).toBe(60);
    expect(rows[1]).toMatchObject({ id: running.id, end_time: null, count: 1, details: ['läuft'] });
  });

  test('an empty list gives an empty list', () => {
    expect(groupByTask([])).toEqual([]);
  });

  test('entries of the same start keep the order of their ids in the details', () => {
    const second = entry('09:00', '09:10', { description: 'b' });
    const first = entry('09:00', '09:10', { description: 'a' });
    first.id = second.id - 1;

    expect(groupByTask([second, first])[0].details).toEqual(['a', 'b']);
  });

  test('does not change the entries it is given', () => {
    const list = [entry('09:00', '09:30', { description: 'x' }), entry('10:00', '10:30')];
    const copy = JSON.parse(JSON.stringify(list));

    groupByTask(list);

    expect(JSON.parse(JSON.stringify(list))).toEqual(copy);
  });

  test('a description of only spaces is no detail', () => {
    const [row] = groupByTask([entry('09:00', '09:30', { description: '   ' }), entry('10:00', '10:30', { description: ' ok ' })]);

    expect(row.details).toEqual(['ok']);
  });
});

describe('rowText', () => {
  test('is the description of an entry, and empty without one', () => {
    expect(rowText({ description: 'Konzept', task: 'Fix' })).toBe('Konzept');
    expect(rowText({ description: null })).toBe('');
  });

  test('reads "Task: detail; detail" for a group', () => {
    expect(rowText({ task: 'Fix login', details: ['review', 'redirect'] })).toBe('Fix login: review; redirect');
  });

  test('is only the task for a group without details', () => {
    expect(rowText({ task: 'Fix login', details: [] })).toBe('Fix login');
  });
});

describe('groupByTask: a running entry with a task in a grouped export', () => {
  test('rowText names its task, with the description as the detail', () => {
    const running = { id: 1, project_id: 1, task: 'Fix login', description: 'läuft', start_time: new Date('2026-11-24T09:00:00Z'), end_time: null };
    const [row] = groupByTask([running]);

    expect(rowText(row)).toBe('Fix login: läuft');
    expect(row.end_time).toBeNull();
  });
});
