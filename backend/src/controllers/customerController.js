const Customer = require('../models/Customer');
const TimeEntry = require('../models/TimeEntry');
const OPTIONS = require('../config/settingsOptions');
const { LOCALES } = require('../i18n');

const INVALID_REPORT_LANGUAGE = {
  error: `reportLanguage must be null (the language of the app) or one of: ${LOCALES.join(', ')}`,
};

// The report language of the customer from the body: { reportLanguage: undefined } when the body does not mention it
// (the stored language is kept), null for "the language of the app", a language of LOCALES, or { invalid: true }.
function parseReportLanguage(body) {
  if (!('reportLanguage' in body)) return { reportLanguage: undefined };
  const { reportLanguage } = body;
  if (reportLanguage === null || LOCALES.includes(reportLanguage)) return { reportLanguage };
  return { invalid: true };
}

const INVALID_ROUNDING = {
  error: 'roundingMinutes and roundingDirection must both be null (use the global setting) or a valid step and direction',
};

// The customer's own rounding rule from the body: { rounding: undefined } when the body does not mention it (the stored
// rule is kept), { rounding: null } for "use the global setting" (both null), { rounding: { minutes, direction } } for an
// own rule (minutes 0 is no rounding for this customer), or { invalid: true }. The steps and directions are those of
// the settings (config/settingsOptions.js).
function parseRounding(body) {
  if (!('roundingMinutes' in body) && !('roundingDirection' in body)) return { rounding: undefined };
  const { roundingMinutes: minutes, roundingDirection: direction } = body;
  if (minutes === null && direction === null) return { rounding: null };
  if (OPTIONS.roundingMinutes.isValid(minutes) && OPTIONS.roundingDirection.isValid(direction)) {
    return { rounding: { minutes, direction } };
  }
  return { invalid: true };
}

// The optional fields of a customer in the body: { rounding, reportLanguage } (each undefined when not mentioned), or
// { error } with the answer for a 400
function parseOptions(body) {
  const { rounding, invalid } = parseRounding(body);
  if (invalid) return { error: INVALID_ROUNDING };
  const { reportLanguage, invalid: invalidLanguage } = parseReportLanguage(body);
  if (invalidLanguage) return { error: INVALID_REPORT_LANGUAGE };
  return { rounding, reportLanguage };
}

exports.getAll = async (req, res) => {
  try {
    const customers = await Customer.getAll();
    res.json(customers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
};

exports.getById = async (req, res) => {
  try {
    const customer = await Customer.getById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const { rounding, reportLanguage, error } = parseOptions(req.body);
    if (error) {
      return res.status(400).json(error);
    }

    const customer = await Customer.create(name, email || null, rounding, reportLanguage);
    res.status(201).json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create customer' });
  }
};

exports.update = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const { rounding, reportLanguage, error } = parseOptions(req.body);
    if (error) {
      return res.status(400).json(error);
    }

    const customer = await Customer.update(req.params.id, name, email || null, rounding, reportLanguage);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update customer' });
  }
};

exports.delete = async (req, res) => {
  try {
    // Deleting also deletes the customer's projects and entries, so not while one of them runs
    const active = await TimeEntry.getActive();
    if (active && active.customer_id === Number(req.params.id)) {
      return res.status(409).json({ error: 'Stop the running timer before deleting' });
    }

    const customer = await Customer.delete(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
};
