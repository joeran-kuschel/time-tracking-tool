const Project = require('../models/Project');

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

    const project = await Project.update(req.params.id, name, hourlyRate);
    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update project' });
  }
};

exports.delete = async (req, res) => {
  try {
    const project = await Project.delete(req.params.id);
    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};
