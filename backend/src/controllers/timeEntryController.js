const TimeEntry = require('../models/TimeEntry');

exports.create = async (req, res) => {
  try {
    const { projectId, startTime, endTime, description } = req.body;

    if (!projectId || !startTime) {
      return res.status(400).json({ error: 'projectId and startTime are required' });
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

exports.update = async (req, res) => {
  try {
    const { endTime, description } = req.body;

    if (!endTime) {
      return res.status(400).json({ error: 'endTime is required' });
    }

    const entry = await TimeEntry.update(req.params.id, endTime, description);
    res.json(entry);
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
    const entry = await TimeEntry.delete(req.params.id);
    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete time entry' });
  }
};
