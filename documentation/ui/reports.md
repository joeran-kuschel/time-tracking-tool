# Reports

The **Reports** page (German: **Berichte**) shows a customer's time entries of one month and downloads them as a PDF.

## Using it

1. Select a customer. The report of the current month loads right away.
2. Change the month with the arrow buttons (*Previous month*, *Next month*); they cross the turn of the year. Each
   change loads the report again. The month name follows the language.
3. **Download PDF** downloads the same report as a PDF, in the language the UI currently uses. It is only shown when the
   month has entries. The PDF is loaded in the background first: if that fails, the page stays and shows *PDF could
   not be downloaded.* (`role="alert"`) instead of replacing the app with the server's error. The file keeps the name
   the backend gives it (`Content-Disposition`), e.g. `abrechnung-Muster GmbH-2026-9.pdf`. See
   [Reports API](../backend/reports.md).

4. **Status** (*Draft*, *Ready to send*, *Sent*; German: *Entwurf*, *Bereit zum Versand*, *Verschickt*) records where
   the report of this customer and month stands. Changing it saves right away; if saving fails, the select keeps the
   old status and an error shows. Only shown when the month has entries. The Dashboard counts the sent reports of the
   previous month and lists the others. See [Reports API](../backend/reports.md#report-status).

**Open report** in the month summary on the Time tracking page opens this page with that customer already selected.
On the Dashboard, **Monthly reports** opens it without a customer, and **Open report** in the billing notice opens it
with the customer and last month selected.

Months follow the browser's time zone: the page sends it with the request, so an entry started at 00:30 on the 1st
belongs to that month, as on the Dashboard and the Time tracking page. See [Reports API](../backend/reports.md#time-zone).

While a report loads, the previous one is hidden and the page says *Loading...*, so an old report never shows under a
new customer or month.

## The report

- The heading reads *Report Muster GmbH – September 2026* (German: *Abrechnung Muster GmbH – September 2026*).
- Three figures: **Total hours**, **Amount (net)** (hours × the hourly rate of each entry's project) and the hours per
  project.
- A table with date, project, description, hours and amount per entry, and a **Total** row for hours and amount.
- *No entries for this period* when the month is empty.

Amounts are calculated in the browser from the entries the backend returns (each has its project's `hourly_rate`), with
`summary.js`. The PDF doesn't contain amounts yet; it still lists hours only.

## Formats

Dates, hours and amounts follow the language: `2.3.2026`, `1,50 h` and `142,50 €` in German, `3/2/2026`, `1.50 h`
and `€142.50` in English.

## Code

`frontend/src/pages/Reports.jsx`, `summary.js`, `format.js`. Tests: `pages/Reports.test.jsx`, `summary.test.js`.
