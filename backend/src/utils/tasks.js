// The task of a time entry (#121): the name that entries of one activity share. The description stays free text for the
// details of one block of work, so reports and invoices can sum the hours per day and task (groupByTask).

// The longest task, in characters (the column is VARCHAR(100))
const MAX_TASK = 100;

// What a request says about the task: { value } where value is undefined (not sent: keep the stored one), null (clear it)
// or the trimmed text, or { error } with the text of a 400. Only text counts; '' or spaces clear the task.
function parseTask(task) {
  if (task === undefined) return { value: undefined };
  if (task === null) return { value: null };
  if (typeof task !== 'string') return { error: 'task must be text' };
  const text = task.trim();
  if (text.length > MAX_TASK) return { error: `task can be at most ${MAX_TASK} characters` };
  return { value: text || null };
}

// How tasks are compared: ignoring case and surrounding spaces
const taskKey = (task) => task.trim().toLocaleLowerCase('en');

// The day of an instant in a time zone as 'YYYY-MM-DD' (sv-SE writes it so, whatever the language)
const dayInZone = (value, timeZone) =>
  new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(new Date(value));

// The entries with the finished ones that have a task summed up per day (in the time zone), project and task, in the order
// of their first entry. A group becomes one row: the first entry's fields, with the earliest start, an end that makes the
// sum of the durations (not a real time, so a grouped export shows no end), task (the first spelling), details (the
// distinct descriptions in time order), count and entryIds. A running entry with a task is a group of one (it keeps no end).
// Entries without a task stay as they are, so
// everything that counts a row's minutes (rounding, amounts, the report) works on a group like on an entry. Never stored.
// Entries are expected newest first or oldest first, whichever: each group sorts its own entries by start.
function groupByTask(entries, timeZone = 'UTC') {
  const groups = new Map();
  const rows = [];
  for (const entry of entries) {
    if (!entry.task) {
      rows.push(entry);
      continue;
    }
    if (!entry.end_time) {
      // A running entry is no group (it counts 0 hours), but its task shows like the one of a group
      rows.push(sumUp([entry]));
      continue;
    }
    const key = [dayInZone(entry.start_time, timeZone), entry.project_id, taskKey(entry.task)].join('|');
    if (!groups.has(key)) {
      const group = { entries: [] };
      groups.set(key, group);
      rows.push(group);
    }
    groups.get(key).entries.push(entry);
  }
  return rows.map((row) => (row.entries ? sumUp(row.entries) : row));
}

function sumUp(entries) {
  const sorted = [...entries].sort((a, b) => new Date(a.start_time) - new Date(b.start_time) || a.id - b.id);
  if (sorted.length === 1) return { ...sorted[0], details: detailsOf(sorted), count: 1, entryIds: [sorted[0].id] };
  const seconds = sorted.reduce((sum, entry) => sum + (new Date(entry.end_time) - new Date(entry.start_time)) / 1000, 0);
  const start = new Date(sorted[0].start_time);
  return {
    ...sorted[0],
    end_time: new Date(start.getTime() + seconds * 1000),
    details: detailsOf(sorted),
    count: sorted.length,
    entryIds: sorted.map((entry) => entry.id),
  };
}

// The distinct non-empty descriptions in order, compared like tasks
function detailsOf(entries) {
  const seen = new Set();
  const details = [];
  for (const { description } of entries) {
    const text = description?.trim();
    if (text && !seen.has(taskKey(text))) {
      seen.add(taskKey(text));
      details.push(text);
    }
  }
  return details;
}

// The text of a row for the description column of an export: a group (it has details) reads "Task: detail; detail", an
// entry as it is. details are the descriptions of a group, see groupByTask.
function rowText(entry) {
  if (!entry.details) return entry.description || '';
  return entry.details.length > 0 ? `${entry.task}: ${entry.details.join('; ')}` : entry.task;
}

module.exports = { MAX_TASK, parseTask, taskKey, groupByTask, rowText };
