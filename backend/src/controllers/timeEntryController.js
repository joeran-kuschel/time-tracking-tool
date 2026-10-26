const TimeEntry = require('../models/TimeEntry');
const Project = require('../models/Project');
const { parseEntryFilter } = require('../utils/entryFilter');

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

    if (!projectId || !startTime) {
      return res.status(400).json({ error: 'projectId and startTime are required' });
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

    const entry = await TimeEntry.create(projectId, toUtc(startTime), endTime ? toUtc(endTime) : null, description);
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

    if (!endTime) {
      return res.status(400).json({ error: 'endTime is required' });
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
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update time entry' });
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

exports.getByCustomerId = async (req, res) => {
  try {
    const entries = await TimeEntry.getByCustomerId(req.params.customerId);
    res.json(entries);
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
