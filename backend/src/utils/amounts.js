const { i18n } = require('@lingui/core');
const { calculateHours } = require('./hours');

// Money rules of a report, in one place. Amounts are EUR only (there is no currency setting) and are counted in
// whole cents: an entry's hours are rounded to hundredths exactly as the report prints them, its amount is rounded
// to cents, and projects and the total add up those rounded values, so every printed row equals printed hours x
// printed rate and the printed numbers add up exactly.
const CURRENCY = 'EUR';

// An entry that ends before it starts counts as 0 hours and 0 amount, so no amount is ever negative. The hours
// printed in the rows are not changed (calculateHours still gives the negative value).
// An invalid start or end (NaN) counts as 0 too.
const hundredthsOf = (entry) => Math.max(0, Math.round(Number(calculateHours(entry.start_time, entry.end_time)) * 100) || 0);

// hourly_rate is a DECIMAL(10,2) string; a missing or invalid rate counts as 0
function rateCentsOf(entry) {
  const cents = Math.round(Number(entry.hourly_rate) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : 0;
}

// An entry's amount in cents; a running entry has 0 hours and so 0 amount
const entryCents = (entry) => Math.round((hundredthsOf(entry) * rateCentsOf(entry)) / 100);

// { entryCents: number[] (in the order of the entries), projects, totalCents }
// projects are in the order of their first entry: { projectId, name, hundredths, rateCents, cents }
function reportAmounts(entries) {
  const projects = new Map();
  const cents = entries.map((entry) => {
    const key = entry.project_id ?? entry.project_name;
    if (!projects.has(key)) {
      projects.set(key, { projectId: entry.project_id, name: entry.project_name, hundredths: 0, rateCents: rateCentsOf(entry), cents: 0 });
    }
    const project = projects.get(key);
    const amount = entryCents(entry);
    project.hundredths += hundredthsOf(entry);
    project.cents += amount;
    return amount;
  });
  return { entryCents: cents, projects: [...projects.values()], totalCents: cents.reduce((sum, value) => sum + value, 0) };
}

// "80,00 €" in the active language (translate right after activateLocale, see src/i18n.js)
const formatMoney = (cents) => i18n.number(cents / 100, { style: 'currency', currency: CURRENCY });

// Two decimals for the JSON report, whatever the language; takes hundredths of hours or cents
const decimal = (hundredths) => (hundredths / 100).toFixed(2);

module.exports = { CURRENCY, reportAmounts, rateCentsOf, formatMoney, decimal };
