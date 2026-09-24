const contentDisposition = require('content-disposition');
const TimeEntry = require('../models/TimeEntry');
const Customer = require('../models/Customer');
const ReportStatus = require('../models/ReportStatus');
const { parseMonth, parseTimeZone, monthRange } = require('../utils/period');
const { generateReportPDF, reportFileName } = require('../utils/pdfGenerator');

const INVALID_PERIOD = { error: 'month (1-12) and year are required' };

// The report's month from the query: { month, year, timeZone, range }, or null when month or year is invalid.
// tz is the browser's time zone, so the month has the same limits as on the dashboard.
function reportPeriod(query) {
  const period = parseMonth(query.month, query.year);
  if (!period) return null;
  const timeZone = parseTimeZone(query.tz);
  return { ...period, timeZone, range: monthRange(period, timeZone) };
}

exports.generatePDF = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { lang, inline } = req.query;
    const period = reportPeriod(req.query);
    if (!period) {
      return res.status(400).json(INVALID_PERIOD);
    }

    const customer = await Customer.getById(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const entries = await TimeEntry.getByCustomerIdInRange(customerId, period.range);
    if (entries.length === 0) {
      return res.status(404).json({ error: 'No time entries found for the specified month' });
    }

    const { month, year, timeZone } = period;
    const pdfBuffer = await generateReportPDF(entries, { customerName: customer.name, month, year, locale: lang, timeZone });

    // Send PDF: as a download, or with inline=1 to open in the browser (preview).
    // contentDisposition escapes quotes and adds a UTF-8 file name for names like "Łódź".
    res.contentType('application/pdf');
    const fileName = reportFileName(customer.name, month, year, lang);
    res.setHeader('Content-Disposition', contentDisposition(fileName, { type: inline === '1' ? 'inline' : 'attachment' }));
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
};

exports.getMonthlyReport = async (req, res) => {
  try {
    const { customerId } = req.params;
    const period = reportPeriod(req.query);
    if (!period) {
      return res.status(400).json(INVALID_PERIOD);
    }

    const { month, year } = period;
    const [entries, status] = await Promise.all([
      TimeEntry.getByCustomerIdInRange(customerId, period.range),
      ReportStatus.get(customerId, year, month),
    ]);

    res.json({
      customerId,
      month,
      year,
      status,
      entries,
      totalHours: entries.reduce((sum, entry) => {
        if (entry.end_time) {
          const diff = new Date(entry.end_time) - new Date(entry.start_time);
          const hours = diff / (1000 * 60 * 60);
          return sum + hours;
        }
        return sum;
      }, 0).toFixed(2)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch monthly report' });
  }
};

// Sets the status of a customer's monthly report: draft, ready or sent
exports.setStatus = async (req, res) => {
  try {
    const { customerId } = req.params;
    const period = parseMonth(req.body.month, req.body.year);
    if (!period || !ReportStatus.STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: `month, year and a status (${ReportStatus.STATUSES.join(', ')}) are required` });
    }

    const customer = await Customer.getById(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(await ReportStatus.set(customerId, period.year, period.month, req.body.status));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save the report status' });
  }
};
