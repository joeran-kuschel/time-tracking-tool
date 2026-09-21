const TimeEntry = require('../models/TimeEntry');
const Project = require('../models/Project');

const isValidTime = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));

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

    // Only one timer may run at a time; finished entries can always be added
    if (!endTime && await TimeEntry.getActive()) {
      return res.status(409).json({ error: 'A timer is already running' });
    }

    const entry = await TimeEntry.create(projectId, startTime, endTime || null, description);
    res.status(201).json(entry);
  } catch (err) {
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
    // Stopping uses the browser's clock against the server's start time, so it isn't checked
    if (!isStop && new Date(endTime) <= new Date(startTime ?? entry.start_time)) {
      return res.status(400).json({ error: 'endTime must be after startTime' });
    }

    if (projectId !== undefined && Number(projectId) !== entry.project_id) {
      const [target, current] = await Promise.all([Project.getById(projectId), Project.getById(entry.project_id)]);
      if (!target || target.customer_id !== current.customer_id) {
        return res.status(400).json({ error: 'Entries can only move to a project of the same customer' });
      }
    }

    const updated = await TimeEntry.update(req.params.id, { startTime, endTime, projectId, description });
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
