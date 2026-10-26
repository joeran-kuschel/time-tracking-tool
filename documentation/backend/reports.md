# Reports API

Monthly reports list a customer's time entries of one month, as JSON, as a PDF or as a CSV file.

## Endpoints

All paths are under `/api/reports`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/customer/:customerId?month=M&year=YYYY&tz=Europe/Berlin&amounts=1` | The report as JSON |
| `GET` | `/customer/:customerId/pdf?month=M&year=YYYY&lang=de\|en&tz=Europe/Berlin&amounts=1` | The report as a PDF download; with `&inline=1` the browser shows it instead (the Dashboard's **Preview PDF**) |
| `GET` | `/customer/:customerId/csv?month=M&year=YYYY&lang=de\|en&tz=Europe/Berlin&amounts=1` | The same entries as a CSV download, see below |
| `PUT` | `/customer/:customerId/status` | Sets the report status, see below |

`month` (1–12) and `year` are required; a missing or invalid value answers `400` (`month=abc`, `month=13`).
`amounts` is optional, see [Amounts](#amounts).

## Amounts

Amounts (hourly rate × hours) are optional, because the report is not the invoice. The query parameter `amounts` of the
JSON report, the PDF and the CSV is absent, `0` or `1`; anything else (`amounts=2`, `amounts=`, `amounts=abc`, a
repeated `amounts`) answers `400` with `{ "error": "amounts must be 0 or 1" }`. `reportController.js` reads it with
`parseFlag`. **Without the flag, or with `0`, every output is exactly what it was before**: the same JSON fields, the
same PDF layout and the same CSV columns. The Dashboard and its **Preview PDF** link never pass it.

The money rules are in one place, `utils/amounts.js`, and are the same for all three formats:

- An entry's hours are rounded to hundredths exactly as the PDF and the CSV print them (`calculateHours`).
- The rate is the project's `hourly_rate` (`DECIMAL(10,2)`), counted in cents. A missing or invalid rate counts as 0.
- An entry's amount is `round(hours in hundredths × rate in cents / 100)` cents, so every printed row equals the
  printed hours × the printed rate.
- A project's amount is the sum of its entries' amounts and the total is the sum of the projects, so the printed
  numbers add up exactly (20 minutes at 33,33 €/h are 0,33 h = 11,00 €, not 11,11 €). Hours per project and in the
  total add up the rounded entry hours (except entries that end before they start, see below).
- A running entry (no end time) has 0 hours and 0 amount; its row is still shown. A project with a rate of 0 is shown
  with `0,00 €`, not hidden.
- An entry that ends before it starts counts as 0 hours and 0,00 € in the amounts (so no amount is ever negative), and
  the project hours add up the same 0. Fix the entry's times; saving such entries is not prevented yet. The hours
  printed in the entry rows and `totalHours` are not changed and still show the negative value.
- The currency is always EUR; there is no currency setting. Projects keep the order of their first entry.

## Time zone

`tz` is the browser's IANA time zone (the frontend sends `Intl.DateTimeFormat().resolvedOptions().timeZone`). A month
runs from midnight on the 1st to midnight on the 1st of the next month **in that time zone**, so the report has the
same entries as the Dashboard and the Time tracking page. An entry started at 00:30 on 1 October in Berlin belongs to
October. Without `tz`, or with an unknown one, the month is taken in UTC.

`utils/period.js` turns month, year and time zone into a UTC range with `monthRange`; the queries select entries with
`from <= start_time < to`. Times are stored as UTC, and the backend runs in UTC (`process.env.TZ` is set in
`server.js`), because `pg` reads `TIMESTAMP` columns as local time.

## JSON report

```json
{
  "customerId": "1",
  "month": 9,
  "year": 2026,
  "entries": [{ "id": 1, "start_time": "…", "end_time": "…", "description": "…",
                "project_name": "Website", "hourly_rate": "80.00", "customer_name": "Muster GmbH", "customer_id": 1 }],
  "totalHours": "1.50",
  "status": "draft"
}
```

- Entries are all entries of the customer's projects whose **start time** lies in the month, newest first.
- Running entries (no `end_time`) are included and count as 0 hours.
- `totalHours` is a string with two decimals.
- `status` is the report status of that customer and month.
- With `amounts=1` each entry also has `amount` (a string with two decimals), and the report has `currency` (`"EUR"`),
  `totalAmount` and `projects`, one line per project in the order of its first entry:
  `{ "projectId": 1, "name": "Website", "hours": "1.50", "hourlyRate": "80.00", "amount": "120.00" }`
  (all numbers are strings with two decimals).

## PDF report

- Title, month, customer, a table (date, project, hours, description) and the total hours.
- Each row is as tall as its tallest cell: long project names and descriptions wrap inside their column. A row that
  doesn't fit starts a new page, which repeats the column titles.
- Dates are shown in the `tz` time zone.
- With `amounts=1` the table has an Amount column after the hours (no per row rate column, the layout is: date,
  project, hours, amount, description), followed by a block **Per project** (German: *Je Projekt*) with a row per
  project: hours, rate (`80,00 €/h`) and amount. The block has its own column titles, which a page break repeats like
  those of the main table. The total block has a second line, **TOTAL AMOUNT:** (*GESAMTBETRAG:*), under the total
  hours. The `€` sign is in the embedded font (a test checks the character map of a real PDF).
- The font is IBM Plex Sans (regular and semibold), the app's font. The files are in `backend/assets/fonts/` (complete
  WOFF files from `@ibm/plex-sans` 1.1.0, with their SIL Open Font License in `OFL.txt`) and are copied into the Docker
  image. They cover Central European letters (`Ł`, `ź`, `Š`), Greek and Cyrillic, which pdfkit's built-in Helvetica
  lacks. pdfkit embeds only the letters a report uses.
- The texts and formats follow `lang` (`de` or `en`); without it or with another value, the PDF is German, as it was
  before translation. See [Translation](translation.md).
- The file name follows the language too: `time-report-<customer>-<year>-<month>.pdf` or
  `abrechnung-<customer>-<year>-<month>.pdf`.
- The `Content-Disposition` header is built with the `content-disposition` package: quotes are escaped, and names
  outside Latin-1 (`Łódź`, `€`) get an additional UTF-8 file name (`filename*=UTF-8''…`).
- `404` if the customer doesn't exist or has no entries in the month.

## CSV export

The CSV has exactly the entries of the PDF (the customer's entries of one month, newest first, running ones included),
for spreadsheets. `loadReport` in `reportController.js` is shared with the PDF, so the checks and the wording of the
errors are the same: `400` for an invalid `month` or `year`, `404` for an unknown customer or a month without entries.

- **Columns** (`utils/reportRows.js`, the one place that defines them): Date, Start, End, Customer, Project,
  Description, Hours. Dates are `YYYY-MM-DD`, times `HH:mm`, both in the `tz` time zone, so an entry at 00:30 on the 1st
  shows the date of that month. A running entry has an empty End and 0 hours. Hours are a plain number with two decimals
  and no unit (`1,50` in German, `1.50` in English). With `amounts=1` two number columns follow the hours: **Rate
  (EUR/h)** (*Stundensatz (EUR/h)*) and **Amount (EUR)** (*Betrag (EUR)*), formatted like the hours; there is no total
  row.
- **Cells are typed**: `reportRows` returns `{ headers, rows }` where a cell is `{ text }` or `{ number }`, so a format
  can treat numbers and texts differently (the CSV protects texts only; a later Excel export could write real numbers).
- **Language** (`lang`, `de` by default): the column titles and the format follow it. German files use `;` as delimiter
  and a decimal comma, English files use `,` and a decimal point, so the file opens correctly in a spreadsheet set to
  the same language. The column titles are translated with the ids `report.date`, `export.start`, `export.end`,
  `export.customer`, `report.project`, `report.description`, `report.hours`, and with amounts `export.rate` and `export.amount` (see
  [Translation](translation.md)). The PDF's amount texts use `report.amount`, `report.rate`, `report.projects` and
  `report.totalAmount`.
- **Format** (`utils/csv.js`, written by hand, no dependency): UTF-8 with a byte order mark (so Excel reads umlauts and
  `Ł` correctly), `\r\n` line endings, also after the last line. A field with the delimiter, a quote, a CR or an LF is
  put in quotes with inner quotes doubled.
- **Formula injection**: a text cell (descriptions, project and customer names, headers) that starts with `=`, `+`, `-`,
  `@`, a tab or a carriage return gets a `'` in front, so a spreadsheet shows it as text instead of running it as a
  formula. Number cells are never changed.
- **File name**: `time-report-<customer>-<year>-<month>.csv` or `abrechnung-<customer>-<year>-<month>.csv`
  (`reportFileName` with the extension `csv`), sent like the PDF's with the `content-disposition` package
  (`attachment`, non-ASCII names get `filename*=UTF-8''…`). `Content-Type` is `text/csv; charset=utf-8`.
- `500` answers `Failed to export CSV report`.

## Report status

Each customer's monthly report has a status: `draft`, `ready` or `sent`. It is set by hand on the Reports page and
counted on the Dashboard (*Reports sent*).

`PUT /api/reports/customer/:customerId/status` with `{ "month": 8, "year": 2026, "status": "sent" }` stores it and
answers `{ "customer_id": 1, "year": 2026, "month": 8, "status": "sent" }`. `400` for a missing or invalid month, year
or status; `404` for an unknown customer.

Stored in the table `report_status` (migration `002_report_status.sql`, see [Database](database.md)). A month without a
row is a `draft`. The status is deleted with its customer.

## Limits

- Amounts are EUR only and have to be asked for with `amounts=1`; the Reports page checkbox for it follows in the next
  change. The CSV has no total row.
- The CSV covers one customer and one month; no free date range, project filter or Excel file yet.

## Code

`backend/src/routes/reports.js`, `controllers/reportController.js`, `utils/pdfGenerator.js`, `utils/reportRows.js`, `utils/amounts.js`, `utils/hours.js`, `utils/csv.js`,
`models/TimeEntry.js` (`getByCustomerIdInRange`), `models/ReportStatus.js`, `utils/period.js`. Tests:
`tests/reportStatus.model.test.js`, `tests/pdfGenerator.test.js`, `tests/period.test.js`, `tests/timeEntry.model.test.js`,
`tests/pdfGenerator.real.test.js`, `tests/reportController.test.js`, `tests/csv.test.js`, `tests/reportRows.test.js`,
`tests/report.export.routes.test.js`, `tests/amounts.test.js`.
