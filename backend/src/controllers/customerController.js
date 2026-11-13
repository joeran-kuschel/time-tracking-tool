const Customer = require('../models/Customer');
const TimeEntry = require('../models/TimeEntry');
const OPTIONS = require('../config/settingsOptions');

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
    const { rounding, invalid } = parseRounding(req.body);
    if (invalid) {
      return res.status(400).json(INVALID_ROUNDING);
    }

    const customer = await Customer.create(name, email || null, rounding);
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
    const { rounding, invalid } = parseRounding(req.body);
    if (invalid) {
      return res.status(400).json(INVALID_ROUNDING);
    }

    const customer = await Customer.update(req.params.id, name, email || null, rounding);
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
