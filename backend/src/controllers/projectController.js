const Project = require('../models/Project');
const TimeEntry = require('../models/TimeEntry');

// A missing rate is allowed (0 on create, unchanged on update); otherwise a number >= 0
const isValidRate = (rate) => rate === undefined || rate === null || (rate !== '' && Number.isFinite(Number(rate)) && Number(rate) >= 0);

exports.getByCustomerId = async (req, res) => {
  try {
    const projects = await Project.getByCustomerId(req.params.customerId);
    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

exports.getById = async (req, res) => {
  try {
    const project = await Project.getById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
};

exports.create = async (req, res) => {
  try {
    const { customerId, name, hourlyRate } = req.body;

    if (!customerId || !name) {
      return res.status(400).json({ error: 'customerId and name are required' });
    }
    if (!isValidRate(hourlyRate)) {
      return res.status(400).json({ error: 'hourlyRate must be a number of at least 0' });
    }

    const project = await Project.create(customerId, name, hourlyRate || 0);
    res.status(201).json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

exports.update = async (req, res) => {
  try {
    const { name, hourlyRate } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!isValidRate(hourlyRate)) {
      return res.status(400).json({ error: 'hourlyRate must be a number of at least 0' });
    }

    const project = await Project.update(req.params.id, name, hourlyRate);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update project' });
  }
};

exports.delete = async (req, res) => {
  try {
    // Deleting also deletes the project's entries, so not while one of them runs
    const active = await TimeEntry.getActive();
    if (active && active.project_id === Number(req.params.id)) {
      return res.status(409).json({ error: 'Stop the running timer before deleting' });
    }

    const project = await Project.delete(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};
