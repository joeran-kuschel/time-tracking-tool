const TimeEntry = require('../models/TimeEntry');
const Customer = require('../models/Customer');
const ReportStatus = require('../models/ReportStatus');
const { parseMonth } = require('../utils/period');
const { generateReportPDF, reportFileName } = require('../utils/pdfGenerator');

exports.generatePDF = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { month, year, lang, inline } = req.query;

    if (!month || !year) {
      return res.status(400).json({ error: 'month and year are required' });
    }

    // Verify customer exists
    const customer = await Customer.getById(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get time entries for the customer and month
    const entries = await TimeEntry.getByCustomerIdAndMonth(customerId, parseInt(year), parseInt(month));

    if (entries.length === 0) {
      return res.status(404).json({ error: 'No time entries found for the specified month' });
    }

    // Generate PDF
    const pdfBuffer = await generateReportPDF(entries, customer.name, month, year, lang);

    // Send PDF: as a download, or with inline=1 to open in the browser (preview)
    res.contentType('application/pdf');
    const disposition = inline === '1' ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disposition}; filename="${reportFileName(customer.name, month, year, lang)}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
};

exports.getMonthlyReport = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ error: 'month and year are required' });
    }

    const [entries, status] = await Promise.all([
      TimeEntry.getByCustomerIdAndMonth(customerId, parseInt(year), parseInt(month)),
      ReportStatus.get(customerId, parseInt(year), parseInt(month)),
    ]);

    res.json({
      customerId,
      month: parseInt(month),
      year: parseInt(year),
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
