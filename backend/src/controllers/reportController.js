const { create: contentDisposition } = require('content-disposition');
const TimeEntry = require('../models/TimeEntry');
const Customer = require('../models/Customer');
const ReportStatus = require('../models/ReportStatus');
const { parseMonth, parseTimeZone, monthRange } = require('../utils/period');
const { generateReportPDF, reportFileName } = require('../utils/pdfGenerator');
const { reportRows } = require('../utils/reportRows');
const { toCsv } = require('../utils/csv');
const { activateLocale } = require('../i18n');
const { reportAmounts, decimal, CURRENCY } = require('../utils/amounts');

const INVALID_PERIOD = { error: 'month (1-12) and year are required' };
const INVALID_AMOUNTS = { error: 'amounts must be 0 or 1' };

// A 0/1 flag from the query: false when absent or "0", true for "1", null for anything else (also a repeated parameter)
function parseFlag(value) {
  if (value === undefined || value === '0') return false;
  return value === '1' ? true : null;
}

// The report's month from the query: { month, year, timeZone, range }, or null when month or year is invalid.
// tz is the browser's time zone, so the month has the same limits as on the dashboard.
function reportPeriod(query) {
  const period = parseMonth(query.month, query.year);
  if (!period) return null;
  const timeZone = parseTimeZone(query.tz);
  return { ...period, timeZone, range: monthRange(period, timeZone) };
}

// The customer and the entries of a report's month, shared by the PDF and the CSV. Answers 400 or 404 itself and
// returns null then (the same wording for both formats).
async function loadReport(req, res) {
  const amounts = parseFlag(req.query.amounts);
  if (amounts === null) {
    res.status(400).json(INVALID_AMOUNTS);
    return null;
  }
  const period = reportPeriod(req.query);
  if (!period) {
    res.status(400).json(INVALID_PERIOD);
    return null;
  }

  const { customerId } = req.params;
  const customer = await Customer.getById(customerId);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return null;
  }

  const entries = await TimeEntry.getByCustomerIdInRange(customerId, period.range);
  if (entries.length === 0) {
    res.status(404).json({ error: 'No time entries found for the specified month' });
    return null;
  }
  return { customer, entries, period, amounts };
}

// Sends a report file. contentDisposition escapes quotes and adds a UTF-8 file name for names like "Łódź".
function sendFile(res, { body, contentType, customer, period, lang, extension, type = 'attachment' }) {
  res.contentType(contentType);
  const fileName = reportFileName(customer.name, period.month, period.year, lang, extension);
  res.setHeader('Content-Disposition', contentDisposition(fileName, { type }));
  res.send(body);
}

exports.generatePDF = async (req, res) => {
  try {
    const { lang, inline } = req.query;
    const report = await loadReport(req, res);
    if (!report) return;

    const { customer, entries, period, amounts } = report;
    const { month, year, timeZone } = period;
    const pdfBuffer = await generateReportPDF(entries, { customerName: customer.name, month, year, locale: lang, timeZone, ...(amounts && { amounts }) });

    // As a download, or with inline=1 to open in the browser (preview)
    sendFile(res, { body: pdfBuffer, contentType: 'application/pdf', customer, period, lang, extension: 'pdf', type: inline === '1' ? 'inline' : 'attachment' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
};

// The same entries as the PDF, as a CSV file for spreadsheets
exports.exportCsv = async (req, res) => {
  try {
    const { lang } = req.query;
    const report = await loadReport(req, res);
    if (!report) return;

    const { customer, entries, period, amounts } = report;
    const table = reportRows(entries, { customerName: customer.name, locale: lang, timeZone: period.timeZone, ...(amounts && { amounts }) });

    sendFile(res, { body: toCsv(table, activateLocale(lang)), contentType: 'text/csv; charset=utf-8', customer, period, lang, extension: 'csv' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export CSV report' });
  }
};

// What the JSON report adds with amounts: an amount per entry, the currency, the total and one line per project
// (strings with two decimals, rules in utils/amounts.js)
function amountFields(entries) {
  const { entryCents, projects, totalCents } = reportAmounts(entries);
  return {
    entries: entries.map((entry, index) => ({ ...entry, amount: decimal(entryCents[index]) })),
    currency: CURRENCY,
    totalAmount: decimal(totalCents),
    projects: projects.map((project) => ({
      projectId: project.projectId,
      name: project.name,
      hours: decimal(project.hundredths),
      hourlyRate: decimal(project.rateCents),
      amount: decimal(project.cents),
    })),
  };
}

exports.getMonthlyReport = async (req, res) => {
  try {
    const { customerId } = req.params;
    const amounts = parseFlag(req.query.amounts);
    if (amounts === null) {
      return res.status(400).json(INVALID_AMOUNTS);
    }
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
      ...(amounts && amountFields(entries)),
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
