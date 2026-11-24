const TimeEntry = require('../models/TimeEntry');
const Project = require('../models/Project');
const Settings = require('../models/Settings');
const { parseEntryFilter } = require('../utils/entryFilter');
const { parseTask } = require('../utils/tasks');
const { isId } = require('../utils/invoicing');
const { roundingRuleOf, withBilling } = require('../utils/rounding');

const isValidTime = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));

// Postgres error code of a unique index; for time entries only one_running_timer can raise it on insert
const UNIQUE_VIOLATION = '23505';
const TIMER_RUNNING = { error: 'A timer is already running' };

// The columns are TIMESTAMP WITHOUT TIME ZONE and Postgres drops a UTC offset when it casts text, so times are stored
// as the UTC instant that was validated ("07:30-02:00" would otherwise be stored as 07:30).
const toUtc = (value) => new Date(value).toISOString();

// The end a stopped timer is saved with. Stopping never fails (a running timer can't be deleted, so a refused stop
// would trap the user), but an end before the start is never stored: the sent end counts when it is after the start,
// else the server's clock, else (start in the future) the start itself.
function stopTime(sentEnd, start, now = new Date()) {
  // Compares instants and relies on the backend running in UTC (process.env.TZ in server.js), like the stored times
  const startMs = new Date(start).getTime();
  const end = new Date(sentEnd).getTime() > startMs ? new Date(sentEnd) : now.getTime() > startMs ? now : new Date(startMs);
  return end.toISOString();
}

exports.create = async (req, res) => {
  try {
    const { projectId, startTime, endTime, description } = req.body;
    const task = parseTask(req.body.task);

    if (!projectId || !startTime) {
      return res.status(400).json({ error: 'projectId and startTime are required' });
    }
    if (task.error) {
      return res.status(400).json({ error: task.error });
    }
    if (!isValidTime(startTime) || (endTime && !isValidTime(endTime))) {
      return res.status(400).json({ error: 'startTime and endTime must be valid dates' });
    }
    // Entries added by hand need an end after their start
    if (endTime && new Date(endTime) <= new Date(startTime)) {
      return res.status(400).json({ error: 'endTime must be after startTime' });
    }

    // Only one timer may run at a time; finished entries can always be added.
    // The index one_running_timer catches two starts that pass this check at the same time.
    if (!endTime && await TimeEntry.getActive()) {
      return res.status(409).json(TIMER_RUNNING);
    }

    const entry = await TimeEntry.create(projectId, toUtc(startTime), endTime ? toUtc(endTime) : null, description, task.value);
    res.status(201).json(entry);
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      return res.status(409).json(TIMER_RUNNING);
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create time entry' });
  }
};

// Stops a running entry (endTime, optionally description) or edits a finished one
// (additionally startTime and projectId). Running entries can only be stopped.
exports.update = async (req, res) => {
  try {
    const { startTime, endTime, projectId, description } = req.body;
    const task = parseTask(req.body.task);

    if (!endTime) {
      return res.status(400).json({ error: 'endTime is required' });
    }
    if (task.error) {
      return res.status(400).json({ error: task.error });
    }
    if (!isValidTime(endTime) || (startTime !== undefined && !isValidTime(startTime))) {
      return res.status(400).json({ error: 'startTime and endTime must be valid dates' });
    }

    const entry = await TimeEntry.getById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    const isStop = entry.end_time === null;
    if (isStop && (startTime !== undefined || projectId !== undefined)) {
      return res.status(409).json({ error: 'Stop the timer before editing it' });
    }
    if (!isStop && new Date(endTime) <= new Date(startTime ?? entry.start_time)) {
      return res.status(400).json({ error: 'endTime must be after startTime' });
    }

    if (projectId !== undefined && Number(projectId) !== entry.project_id) {
      const [target, current] = await Promise.all([Project.getById(projectId), Project.getById(entry.project_id)]);
      if (!target || target.customer_id !== current.customer_id) {
        return res.status(400).json({ error: 'Entries can only move to a project of the same customer' });
      }
    }

    const updated = await TimeEntry.update(req.params.id, {
      startTime: startTime === undefined ? undefined : toUtc(startTime),
      endTime: isStop ? stopTime(endTime, entry.start_time) : toUtc(endTime),
      projectId,
      description,
      task: task.value,
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update time entry' });
  }
};

// Starts a finished entry again (no body): the same entry runs on and its end time is cleared, so the time since its
// end counts as work time. 409 while a timer runs (this one included).
exports.resume = async (req, res) => {
  try {
    const entry = await TimeEntry.getById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }
    if (entry.end_time === null) {
      return res.status(409).json({ error: 'This timer is already running' });
    }
    if (await TimeEntry.getActive()) {
      return res.status(409).json(TIMER_RUNNING);
    }

    const resumed = await TimeEntry.resume(req.params.id);
    if (!resumed) {
      return res.status(409).json({ error: 'This timer is already running' });
    }
    res.json(resumed);
  } catch (err) {
    // Another start won the race: the database refuses the second running timer
    if (err.code === UNIQUE_VIOLATION) {
      return res.status(409).json(TIMER_RUNNING);
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to resume time entry' });
  }
};

exports.getActive = async (req, res) => {
  try {
    const entry = await TimeEntry.getActive();
    res.json(entry || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch active time entry' });
  }
};

exports.getByProjectId = async (req, res) => {
  try {
    const entries = await TimeEntry.getByProjectId(req.params.projectId);
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
};

// The customer's entries. With a rounding rule (settings) each one also has billed_hours, billed_amount and billed_rule
// for the month summary and its note; the entries themselves stay exact (utils/rounding.js).
exports.getByCustomerId = async (req, res) => {
  try {
    const [entries, settings] = await Promise.all([TimeEntry.getByCustomerId(req.params.customerId), Settings.get()]);
    res.json(withBilling(entries, roundingRuleOf(settings)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// A whole number in [min, max] from a query value, the fallback when it is missing, or null when it is invalid
function parseInteger(value, { min, max = Number.MAX_SAFE_INTEGER, fallback }) {
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number >= min && number <= max ? number : null;
}

// Searches the entries of all customers (filter: see parseEntryFilter), one page at a time
exports.search = async (req, res) => {
  const { filter, error } = parseEntryFilter(req.query);
  const limit = parseInteger(req.query.limit, { min: 1, max: MAX_LIMIT, fallback: DEFAULT_LIMIT });
  const offset = parseInteger(req.query.offset, { min: 0, fallback: 0 });
  if (error || limit === null || offset === null) {
    return res.status(400).json({
      error: error || `limit (1-${MAX_LIMIT}) and offset (0 or more) must be whole numbers`,
    });
  }

  try {
    const result = await TimeEntry.search(filter, { limit, offset });
    res.json({ ...result, limit, offset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to search time entries' });
  }
};

exports.getById = async (req, res) => {
  try {
    const entry = await TimeEntry.getById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }
    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch time entry' });
  }
};

exports.delete = async (req, res) => {
  try {
    const entry = await TimeEntry.getById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found' });
    }
    if (entry.end_time === null) {
      return res.status(409).json({ error: 'Stop the timer before deleting it' });
    }

    res.json(await TimeEntry.delete(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete time entry' });
  }
};

// The tasks used in a project, most recent first, for the suggestions of the Task field
exports.getTasks = async (req, res) => {
  try {
    if (!isId(req.params.projectId)) {
      return res.status(400).json({ error: 'projectId must be a record id' });
    }
    res.json(await TimeEntry.getTasks(Number(req.params.projectId)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

// The most entries one request sets the task of
const MAX_TASK_IDS = 1000;
const MAX_ID = 2147483647;

// Sets the task of several finished entries at once: { ids, task } (task '' or null clears it). 400 for a bad request, 404 when
// an entry is unknown, 409 when one is the running timer; in both cases nothing changes. Answers { updated } with the number
// of entries changed.
exports.setTask = async (req, res) => {
  try {
    const body = req.body ?? {};
    const task = parseTask(body.task);
    if (task.error) {
      return res.status(400).json({ error: task.error });
    }
    if (body.task === undefined) {
      return res.status(400).json({ error: 'task is required (an empty text clears it)' });
    }
    const ids = Array.isArray(body.ids) ? [...new Set(body.ids)] : null;
    if (!ids || ids.length === 0 || ids.length > MAX_TASK_IDS || !ids.every((id) => Number.isInteger(id) && id >= 1 && id <= MAX_ID)) {
      return res.status(400).json({ error: `ids must be 1 to ${MAX_TASK_IDS} entry ids` });
    }

    const states = await TimeEntry.getStates(ids);
    if (states.length !== ids.length) {
      return res.status(404).json({ error: 'Time entry not found' });
    }
    if (states.some((state) => state.end_time === null)) {
      return res.status(409).json({ error: 'Stop the timer before changing its task' });
    }

    res.json({ updated: await TimeEntry.setTask(ids, task.value) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to set the task' });
  }
};
