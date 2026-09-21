# Reports API

Monthly reports list a customer's time entries of one month, as JSON or as a PDF.

## Endpoints

All paths are under `/api/reports`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/customer/:customerId?month=M&year=YYYY` | The report as JSON |
| `GET` | `/customer/:customerId/pdf?month=M&year=YYYY&lang=de\|en` | The report as a PDF download |

`month` (1–12) and `year` are required (`400` otherwise).

## JSON report

```json
{
  "customerId": "1",
  "month": 9,
  "year": 2026,
  "entries": [{ "id": 1, "start_time": "…", "end_time": "…", "description": "…",
                "project_name": "Website", "hourly_rate": "80.00", "customer_name": "Muster GmbH", "customer_id": 1 }],
  "totalHours": "1.50"
}
```

- Entries are all entries of the customer's projects whose **start time** lies in the month, newest first.
- Running entries (no `end_time`) are included and count as 0 hours.
- `totalHours` is a string with two decimals.

## PDF report

- Title, month, customer, a table (date, project, hours, description) and the total hours.
- The texts and formats follow `lang` (`de` or `en`); without it or with another value, the PDF is German, as it was
  before translation. See [Translation](translation.md).
- The file name follows the language too: `time-report-<customer>-<year>-<month>.pdf` or
  `abrechnung-<customer>-<year>-<month>.pdf`.
- `404` if the customer doesn't exist or has no entries in the month.

## Limits

- Month boundaries are computed in the server's time zone, which is UTC in the container. An entry started between
  00:00 and 02:00 German time on the 1st of a month counts toward the previous month.
- Amounts (hours × hourly rate) are not shown yet.
- Customer names with characters outside Latin-1 (for example `€`) in the file name are not encoded for the
  `Content-Disposition` header.

## Code

`backend/src/routes/reports.js`, `controllers/reportController.js`, `utils/pdfGenerator.js`,
`models/TimeEntry.js` (`getByCustomerIdAndMonth`). Tests: `tests/pdfGenerator.test.js`,
`tests/pdfGenerator.real.test.js`, `tests/reportController.test.js`.
