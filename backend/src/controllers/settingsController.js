const Settings = require('../models/Settings');

// The options a client may set, each with a function that tells whether a value is valid. Empty until the first
// option exists; GET answers with all options, PUT takes any of them.
const VALIDATORS = {};

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
      if (!Object.hasOwn(VALIDATORS, name)) return res.status(400).json({ error: `Unknown setting: ${name}` });
      if (!VALIDATORS[name](value)) return res.status(400).json({ error: `Invalid value for ${name}` });
    }
    res.json(await Settings.update(body));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save the settings' });
  }
};
