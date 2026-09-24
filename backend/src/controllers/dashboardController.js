const TimeEntry = require('../models/TimeEntry');
const Project = require('../models/Project');
const ReportStatus = require('../models/ReportStatus');
const { parseMonth, previousMonth, parseTimeZone, monthRange } = require('../utils/period');

const RECENT_ENTRIES = 5;

const validDate = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));

// Everything the dashboard shows, in one request. The client sums up hours and amounts itself.
// from/to: the entries to load (the month plus the current week, which can reach into another month).
// month/year: the dashboard's month; its report figures are about the month before.
// tz: the browser's time zone, which sets where that month begins and ends.
exports.get = async (req, res) => {
  try {
    const { from, to } = req.query;
    const period = parseMonth(req.query.month, req.query.year);
    if (!validDate(from) || !validDate(to) || new Date(from) >= new Date(to) || !period) {
      return res.status(400).json({ error: 'from, to, month and year are required' });
    }

    const lastMonth = previousMonth(period);
    const [entries, recent, projects, reports] = await Promise.all([
      TimeEntry.getInRange(from, to),
      TimeEntry.getRecent(RECENT_ENTRIES),
      Project.getAllWithCustomer(),
      ReportStatus.forMonth(lastMonth.year, lastMonth.month, monthRange(lastMonth, parseTimeZone(req.query.tz))),
    ]);

    res.json({ entries, recent, projects, lastMonthReports: { ...lastMonth, reports } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load the dashboard' });
  }
};
