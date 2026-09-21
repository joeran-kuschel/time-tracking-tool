# Reports

The **Reports** page (German: **Berichte**) shows a customer's time entries of one month and downloads them as a PDF.

## Using it

1. Select a customer, a month and a year. The month names follow the language.
2. **Show report** loads the report: date, project, hours and description per entry, and the total hours.
3. **Download PDF** downloads the same report as a PDF, in the language the UI currently uses. See
   [Reports API](../backend/reports.md).

The heading reads *Report Muster GmbH – September 2026* (German: *Abrechnung Muster GmbH – September 2026*).

## Formats

Dates and hours follow the language: `2.3.2026` and `1,50 h` in German, `3/2/2026` and `1.50 h` in English.

## Known gaps

From the UX review, not fixed yet:

- After changing the customer or month, the old report stays visible under the new heading until **Show report** is
  pressed again.
- **Download PDF** is shown even when the month has no entries; the backend then answers `404` and no PDF is
  downloaded, without an error message.
- The years are fixed to 2024–2027.
- The labels *Customer*, *Month* and *Year* are not linked to their dropdowns (`for`/`id`).
- No amounts (hours × hourly rate).

## Code

`frontend/src/pages/Reports.jsx`, `format.js`. Tests: `pages/Reports.test.jsx`.
