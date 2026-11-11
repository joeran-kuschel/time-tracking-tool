// Rounding of the hours of an entry in reports ("billed hours"). Each entry is rounded on its own to a step of 15 or 30
// minutes, up or to the nearest step (a halfway case rounds up). An entry longer than 0 never counts less than one
// step. The stored entries are never changed; the rounded hours are added as billed_hours where a report needs them.
// The rule is applied to whole seconds, so there are no float errors (a multiple of 15 minutes is exact in hours).

// The rule of the settings ({ roundingMinutes, roundingDirection }) as { minutes, direction }, or null for no rounding
function roundingRuleOf(settings) {
  if (!settings || !(settings.roundingMinutes > 0)) return null;
  return { minutes: settings.roundingMinutes, direction: settings.roundingDirection === 'nearest' ? 'nearest' : 'up' };
}

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

// The entries with billed_hours added; without a rule the entries are returned as they are
function withBilledHours(entries, rule) {
  if (!rule) return entries;
  return entries.map((entry) => ({ ...entry, billed_hours: billedHours(entry, rule) }));
}

module.exports = { roundingRuleOf, billedHours, withBilledHours };
