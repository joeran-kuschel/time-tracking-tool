const PDFDocument = require('pdfkit');

function calculateHours(startTime, endTime) {
  if (!endTime) return 0;
  const diff = new Date(endTime) - new Date(startTime);
  return (diff / (1000 * 60 * 60)).toFixed(2);
}

function generateReportPDF(entries, customerName, month, year) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      // Header
      doc.fontSize(20).font('Helvetica-Bold');
      doc.text('ZEITABRECHNUNG', { align: 'center' });

      doc.fontSize(12).font('Helvetica');
      const monthName = new Date(year, month - 1).toLocaleString('de-DE', { month: 'long', year: 'numeric' });
      doc.text(`${monthName}`, { align: 'center' });
      doc.text(`Kunde: ${customerName}`, { align: 'center' });

      // Spacing
      doc.moveDown(1);

      // Table Header
      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 150;
      const col3 = 300;
      const col4 = 450;

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Datum', col1, tableTop);
      doc.text('Projekt', col2, tableTop);
      doc.text('Stunden', col3, tableTop);
      doc.text('Beschreibung', col4, tableTop);

      // Horizontal line
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      // Table rows
      doc.fontSize(9).font('Helvetica');
      let yPosition = tableTop + 25;
      let totalHours = 0;

      entries.forEach((entry) => {
        const hours = calculateHours(entry.start_time, entry.end_time);
        totalHours += parseFloat(hours);

        const date = new Date(entry.start_time).toLocaleDateString('de-DE');

        doc.text(date, col1, yPosition, { width: 80 });
        doc.text(entry.project_name, col2, yPosition, { width: 130 });
        doc.text(hours + 'h', col3, yPosition, { width: 100 });
        doc.text(entry.description || '', col4, yPosition, { width: 80 });

        yPosition += 20;

        // Add page if needed
        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
        }
      });

      // Footer line
      doc.moveTo(50, yPosition + 5).lineTo(550, yPosition + 5).stroke();

      // Total
      yPosition += 15;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('GESAMTSTUNDEN:', col1, yPosition);
      doc.text(totalHours.toFixed(2) + ' h', col3, yPosition);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  calculateHours,
  generateReportPDF
};
