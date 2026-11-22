const Settings = require('../models/Settings');
const OPTIONS = require('../config/settingsOptions');
const Logo = require('../models/Logo');
const { checkLogo } = require('../utils/logoImage');

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

// Your logo for the PDF report: GET answers with the image (404 without one), PUT stores { contentType, data (base64) }
// after the checks of utils/logoImage.js (400 with a `code` that says what is wrong), DELETE removes it (204).
exports.getLogo = async (req, res) => {
  try {
    const logo = await Logo.get();
    if (!logo) return res.status(404).json({ error: 'No logo stored' });
    res.set('Cache-Control', 'no-store');
    res.type(logo.contentType).send(logo.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load the logo' });
  }
};

exports.putLogo = async (req, res) => {
  try {
    const checked = await checkLogo(req.body);
    if (!checked.ok) return res.status(checked.status).json({ error: checked.error, code: checked.code });
    await Logo.set(checked.contentType, checked.data);
    res.json({ contentType: checked.contentType, bytes: checked.data.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save the logo' });
  }
};

exports.deleteLogo = async (req, res) => {
  try {
    await Logo.remove();
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove the logo' });
  }
};
