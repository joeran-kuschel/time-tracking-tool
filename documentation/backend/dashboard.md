# Dashboard API

One request with everything the [Dashboard](../ui/dashboard.md) shows. The server only loads rows; the browser adds up
hours and amounts (`frontend/src/dashboard.js`).

## Endpoint

`GET /api/dashboard?from=ISO&to=ISO&month=M&year=YYYY&tz=Europe/Berlin`

| Parameter | Meaning |
|---|---|
| `from`, `to` | Entries whose start time lies in `[from, to)`. The client sends its month plus the current week, which can reach into the month before or after (`dashboardRange`). |
| `month`, `year` | The dashboard's month; the report statuses are for the month before it. |
| `tz` | The browser's time zone. It sets where last month begins and ends for the report statuses, as in the [Reports API](reports.md#time-zone). Optional; UTC without it. |

`400` when a parameter is missing, a date is invalid, `from` is not before `to`, or the month is not 1–12.

## Response

```json
{
  "entries": [{ "id": 1, "start_time": "…", "end_time": "…", "description": "…", "project_id": 7,
                "project_name": "Website", "hourly_rate": "95.00", "customer_id": 1, "customer_name": "Muster GmbH" }],
  "recent": [ "…the latest 5 finished entries, same fields, newest first…" ],
  "projects": [{ "id": 7, "name": "Website", "hourly_rate": "95.00", "customer_id": 1, "customer_name": "Muster GmbH" }],
  "lastMonthReports": { "month": 8, "year": 2026,
                        "reports": [{ "customer_id": 1, "customer_name": "Muster GmbH", "status": "ready" }] }
}
```

- `entries` includes running entries (no `end_time`), oldest first.
- With a rounding rule (see [Rounding](reports.md#rounding)) each entry of `entries` also has `billed_hours` (a string
  with two decimals) and `billed_amount` (the amount of the rounded hours, rounded to cents per entry like the report;
  `utils/rounding.js` `withBilling`), both `null` for a running entry or one that ends before it starts, and
  `billed_rule`: `{ "minutes": 15, "direction": "up" }`, the rule that produced the values (on every entry, also a
  running one). The Dashboard adds up the billed values for its billing figures and takes the rule for the notes under
  them from the entries, so a note always names the rule of the figures next to it. The entries themselves and `recent`
  stay exact. Without a rule none of this is there.
- `projects` are all projects, ordered by customer name, then project name.
- `lastMonthReports.reports` has one row per customer with entries in that month, ordered by name; without a stored
  status it is `draft`. See [Reports API](reports.md#report-status).

## Code

`backend/src/routes/dashboard.js`, `controllers/dashboardController.js`, `utils/period.js`, `utils/rounding.js`,
`models/Settings.js`, `models/TimeEntry.js` (`getInRange`, `getRecent`), `models/Project.js` (`getAllWithCustomer`),
`models/ReportStatus.js` (`forMonth`). Tests: `tests/dashboardController.test.js`, `tests/period.test.js`, the model
tests.
