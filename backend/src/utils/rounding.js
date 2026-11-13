// Rounding of the hours of an entry in reports ("billed hours"). Each entry is rounded on its own to a step of 5, 10, 15,
// 30 or 60 minutes, up or to the nearest step (a halfway case rounds up). An entry longer than 0 never counts less than one
// step. The stored entries are never changed; the rounded hours are added as billed_hours where a report needs them.
// The rule is applied to whole seconds, so there are no float errors in the rounding itself. The billed hours are
// printed with two decimals like all hours of a report: a multiple of 15 minutes is exact (0.25 h), a step of 5 or 10
// minutes is not (5 minutes is 0.08 h, 10 minutes is 0.17 h), so blocks of those add up to slightly more or less.

const { reportAmounts, decimal } = require('./amounts');

// The rule of the settings ({ roundingMinutes, roundingDirection }) as { minutes, direction }, or null for no rounding
function roundingRuleOf(settings) {
  if (!settings || !(settings.roundingMinutes > 0)) return null;
  return { minutes: settings.roundingMinutes, direction: settings.roundingDirection === 'nearest' ? 'nearest' : 'up' };
}

// The rule a customer's columns give (rounding_minutes, rounding_direction): both null/undefined use the global rule,
// minutes 0 is no rounding for this customer (null), otherwise the customer's own { minutes, direction }. globalRule is
// the rule of the settings ({ minutes, direction } or null).
function customerRuleOf(minutes, direction, globalRule) {
  if (minutes === null || minutes === undefined) return globalRule;
  return minutes > 0 ? { minutes, direction } : null;
}

// The rule that applies to an entry: the one of its customer (the entry queries add customer_rounding_minutes and
// customer_rounding_direction, see models/TimeEntry.js), else the global one
const ruleOfEntry = (entry, globalRule) => customerRuleOf(entry.customer_rounding_minutes, entry.customer_rounding_direction, globalRule);

// The rule that applies to a customer row (columns rounding_minutes and rounding_direction)
const ruleOfCustomer = (customer, globalRule) => customerRuleOf(customer?.rounding_minutes, customer?.rounding_direction, globalRule);

// A duration in whole seconds rounded to the rule's step; 0 stays 0
function roundSeconds(seconds, { minutes, direction }) {
  const step = minutes * 60;
  if (direction === 'nearest') return Math.max(step, Math.floor((seconds + step / 2) / step) * step);
  return Math.ceil(seconds / step) * step;
}

// The billed hours of an entry as a string with two decimals, or null when the entry has no rounded hours: no rule,
// a running entry (it counts 0 hours until it is stopped) or one that ends before it starts (it keeps today's
// behavior, see utils/amounts.js). An entry of 0 minutes stays 0.
function billedHours(entry, rule) {
  if (!rule || !entry.end_time) return null;
  const seconds = Math.round((new Date(entry.end_time) - new Date(entry.start_time)) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds === 0) return '0.00';
  return (roundSeconds(seconds, rule) / 3600).toFixed(2);
}

// The entries with billed_hours added, each with the rule that applies to it: the one of its customer, else the global
// rule (a customer can have its own rule or none, see ruleOfEntry). Entries are returned as they are when no rule applies to
// any of them.
function withBilledHours(entries, globalRule) {
  if (!globalRule && !entries.some((entry) => entry.customer_rounding_minutes != null)) return entries;
  return entries.map((entry) => ({ ...entry, billed_hours: billedHours(entry, ruleOfEntry(entry, globalRule)) }));
}

// The entries with billed_hours and, for the figures of the Dashboard and the month summary, billed_amount (a string
// with two decimals, rounded to cents per entry by the rule of the reports, see utils/amounts.js), so those figures add
// up exactly like the report. Both are null for an entry without billed hours (running, or ending before it starts):
// the client counts those as before. Every entry also carries billed_rule, the { minutes, direction } that produced
// the values (null when no rule applies to the entry's customer), so the client names the rule that was really applied
// (the note under those figures) without asking the settings again. The entries need hourly_rate. Without a rule
// anywhere they are returned as they are.
function withBilling(entries, globalRule) {
  const rounded = withBilledHours(entries, globalRule);
  if (rounded === entries) return entries;
  const { entryCents } = reportAmounts(rounded);
  return rounded.map((entry, index) => ({
    ...entry,
    billed_amount: entry.billed_hours === null ? null : decimal(entryCents[index]),
    billed_rule: ruleOfEntry(entry, globalRule),
  }));
}

module.exports = { roundingRuleOf, ruleOfEntry, ruleOfCustomer, billedHours, withBilledHours, withBilling };
