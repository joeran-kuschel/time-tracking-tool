const Settings = require('../models/Settings');
const OPTIONS = require('../config/settingsOptions');

exports.get = async (req, res) => {
  try {
    res.json(await Settings.get());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load the settings' });
  }
};

exports.update = async (req, res) => {
  try {
    const body = req.body;
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'The settings must be an object' });
    }
    for (const [name, value] of Object.entries(body)) {
      if (!Object.hasOwn(OPTIONS, name)) return res.status(400).json({ error: `Unknown setting: ${name}` });
      if (!OPTIONS[name].isValid(value)) return res.status(400).json({ error: `Invalid value for ${name}` });
    }
    res.json(await Settings.update(body));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save the settings' });
  }
};
