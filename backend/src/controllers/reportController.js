const TimeEntry = require('../models/TimeEntry');
const Customer = require('../models/Customer');
const { generateReportPDF, reportFileName } = require('../utils/pdfGenerator');

exports.generatePDF = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { month, year, lang } = req.query;

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

    // Send PDF
    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${reportFileName(customer.name, month, year, lang)}"`);
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

    const entries = await TimeEntry.getByCustomerIdAndMonth(customerId, parseInt(year), parseInt(month));

    res.json({
      customerId,
      month: parseInt(month),
      year: parseInt(year),
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
