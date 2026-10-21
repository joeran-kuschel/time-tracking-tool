# Reports API

Monthly reports list a customer's time entries of one month, as JSON, as a PDF or as a CSV file.

## Endpoints

All paths are under `/api/reports`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/customer/:customerId?month=M&year=YYYY&tz=Europe/Berlin` | The report as JSON |
| `GET` | `/customer/:customerId/pdf?month=M&year=YYYY&lang=de\|en&tz=Europe/Berlin` | The report as a PDF download; with `&inline=1` the browser shows it instead (the Dashboard's **Preview PDF**) |
| `GET` | `/customer/:customerId/csv?month=M&year=YYYY&lang=de\|en&tz=Europe/Berlin` | The same entries as a CSV download, see below |
| `PUT` | `/customer/:customerId/status` | Sets the report status, see below |

`month` (1–12) and `year` are required; a missing or invalid value answers `400` (`month=abc`, `month=13`).

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

## PDF report

- Title, month, customer, a table (date, project, hours, description) and the total hours.
- Each row is as tall as its tallest cell: long project names and descriptions wrap inside their column. A row that
  doesn't fit starts a new page, which repeats the column titles.
- Dates are shown in the `tz` time zone.
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
  and no unit (`1,50` in German, `1.50` in English). Amounts are not included yet.
- **Cells are typed**: `reportRows` returns `{ headers, rows }` where a cell is `{ text }` or `{ number }`, so a format
  can treat numbers and texts differently (the CSV protects texts only; a later Excel export could write real numbers).
- **Language** (`lang`, `de` by default): the column titles and the format follow it. German files use `;` as delimiter
  and a decimal comma, English files use `,` and a decimal point, so the file opens correctly in a spreadsheet set to
  the same language. The column titles are translated with the ids `report.date`, `export.start`, `export.end`,
  `export.customer`, `report.project`, `report.description`, `report.hours` (see [Translation](translation.md)).
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

- Amounts (hours × hourly rate) are not in the PDF or the CSV yet.
- The CSV covers one customer and one month; no free date range, project filter or Excel file yet.

## Code

`backend/src/routes/reports.js`, `controllers/reportController.js`, `utils/pdfGenerator.js`, `utils/reportRows.js`, `utils/csv.js`,
`models/TimeEntry.js` (`getByCustomerIdInRange`), `models/ReportStatus.js`, `utils/period.js`. Tests:
`tests/reportStatus.model.test.js`, `tests/pdfGenerator.test.js`, `tests/period.test.js`, `tests/timeEntry.model.test.js`,
`tests/pdfGenerator.real.test.js`, `tests/reportController.test.js`, `tests/csv.test.js`, `tests/reportRows.test.js`,
`tests/report.export.routes.test.js`.
