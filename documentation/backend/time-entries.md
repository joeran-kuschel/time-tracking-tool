# Time entries API

Time entries record working time for a project. An entry without `end_time` is a running timer.

## Endpoints

All paths are under `/api/time-entries`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/active` | The running entry with `project_name`, `customer_id` and `customer_name`, or `null` |
| `GET` | `/project/:projectId` | All entries of a project, newest first |
| `GET` | `/customer/:customerId` | All entries of a customer's projects with `project_name`, ordered by project name, then newest first; `[]` for an unknown customer (used by the Time tracking page) |
| `GET` | `/search` | Entries of all customers matching a text, customer, project and period, with `total` and `hours` (used by the Entries page, see [Searching entries](#searching-entries)) |
| `GET` | `/:id` | One entry, or `404` |
| `POST` | `/` | Create an entry (start a timer, or add a finished entry) |
| `PATCH` | `/:id` | Stop a running entry, or edit a finished one |
| `DELETE` | `/:id` | Delete a finished entry |

`/active` and `/search` are registered before `/:id`, so they are never read as an id. A test checks the order.

## Creating entries

Body: `{ projectId, startTime, endTime?, description? }`. `projectId` and `startTime` are required (`400` otherwise).
Times must be valid dates (`400` otherwise). An entry added by hand (with `endTime`) needs its end after its start
(`400` otherwise). Overlapping entries are allowed.

Only one timer may run at a time. Creating an entry **without** `endTime` while another entry has no `end_time` answers
`409` with `{ "error": "A timer is already running" }`. Entries **with** `endTime` can always be added.

The controller checks this first, for a clear answer. Two start requests at the same moment (a double click) could
both pass that check, so the database enforces the rule as well: the partial unique index `one_running_timer`
(migration `003_one_running_timer.sql`) allows at most one entry without `end_time`. When it refuses an insert
(Postgres error `23505`), the controller answers the same `409`. The frontend also sends only one start or stop at a
time, see [Timer](../ui/timer.md).

## Updating entries

Body: `{ endTime, startTime?, projectId?, description? }`. `endTime` is required (`400` otherwise).

- **Stopping** a running entry: send `endTime` (and optionally `description`). Stopping never fails because of its end
  time: a running timer can't be deleted (`409`), so a refused stop would trap the user. The sent end is stored when
  it is after the start. Otherwise (the browser's clock is behind, was set back between start and stop, or the timer
  was started on another device) the server's clock is the end; if even that is not after the start (a start in the
  future), the end equals the start, a 0-hour entry. An end before the start is never stored. The comparison and the storage rely on the backend running in UTC
  (`process.env.TZ = 'UTC'` in `server.js`), and every time is stored normalised as UTC (`toISOString()`): the columns
  are `TIMESTAMP WITHOUT TIME ZONE`, and Postgres would drop a UTC offset such as `-02:00` from the text it is sent.
  This holds for stopping, editing and adding entries. Sending `startTime` or
  `projectId` for a running entry answers `409`.
- **Editing** a finished entry: every field can change. The end must be after the start (`400` otherwise).
  `projectId` can only move the entry to another project of the same customer (`400` otherwise).
- Fields left out keep their stored value. For `description`, an empty string or `null` clears it; stopping the timer
  sends no description, so it is kept.
- `404` for an unknown entry.

This is a single `UPDATE` (`backend/src/models/TimeEntry.js`, `update(id, { startTime, endTime, projectId, description })`).

## Entries that end before they start

Before this check, stopping the timer could save an entry that ends before it starts. Such old entries count as 0 hours
in the report amounts and show negative hours (see [Reports](reports.md)). To find them, run
`kubectl -n time-tracking exec deploy/postgres -- sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT te.id, te.start_time, te.end_time, p.name FROM time_entries te JOIN projects p ON p.id = te.project_id WHERE te.end_time < te.start_time"'`.
Fix each one by editing it on the Time tracking page; the edit form requires an end after the start. Entries whose end equals
their start are not found by the query: they show 0 h and are harmless. There is no database constraint, because
existing rows would break it.

## Deleting entries

`DELETE /:id` deletes a finished entry. The running entry answers `409`: stop the timer first. `404` for an unknown
entry.

## Searching entries

`GET /api/time-entries/search` returns the entries of **all** customers (running ones included) that match every
parameter given. All parameters are optional; without any, it returns everything.

| Parameter | Meaning |
|---|---|
| `q` | Text in the description, case-insensitive substring. Trimmed, at most 200 characters (`400` otherwise); empty means no filter. Entries without a description never match. |
| `customerId`, `projectId` | Positive integers (`400` otherwise). A project that does not belong to the customer simply gives an empty result. |
| `from`, `to` | `YYYY-MM-DD` in the browser's time zone, `to` included; either may be given alone. `400` for a wrong format, a date that does not exist (`2026-02-30`), a year outside 1000 to 9998 (Postgres cannot store the day after `9999-12-31`) or `from` after `to`. |
| `tz` | The browser's IANA time zone. Unknown or missing falls back to UTC, as in the reports. |
| `sort` | `newest` (default) or `oldest`; ties are broken by the entry id, so pages never overlap. |
| `limit`, `offset` | Page size (default 50, 1 to 200) and the number of entries to skip (default 0). Whole numbers, `400` otherwise. |

Response: `{ entries, total, hours, limit, offset }`. `entries` are one page with `project_name`, `hourly_rate`,
`customer_id` and `customer_name`. `total` counts **all** matches, not only the page. `hours` is the sum of the
finished matches in decimal hours (running entries count in `total` but add no hours); `0` when nothing matches.

- **Time zone rule:** an entry belongs to the day it **starts** in (`start_time`), like in the reports. `dayRange` in
  `backend/src/utils/period.js` turns the days into instants, `from <= start_time < to`, so a daylight saving switch
  is handled.
- **Literal matching:** the text is compared with `strpos(lower(description), lower($n)) > 0` instead of `LIKE`, so
  `%`, `_` and `\` in the search text mean themselves and need no escaping. User input only goes into query
  parameters, never into the SQL text. (`strpos` is standard in Postgres; pg-mem lacks both it and `LIKE ... ESCAPE`,
  so `tests/helpers/testDb.js` registers a `strpos` function.)
- **No index:** the search scans the entries. That is fine for one freelancer's data. If it gets slow, the documented
  upgrade is the `pg_trgm` extension with a GIN index on `lower(description)` (a new migration in
  `backend/migrations/`, then `./k8s/generate-init-scripts.sh`; an existing volume needs the SQL applied by hand, see
  [Deployment](deployment.md)). The query would then use `ILIKE` with an escaped pattern, which can use the index.
- **Reuse:** `parseEntryFilter` in `backend/src/utils/entryFilter.js` reads and validates `q`, `customerId`,
  `projectId`, `from`, `to`, `tz` and `sort`; `TimeEntry.search(filter, { limit, offset })` takes `limit: null` for
  all rows. A CSV export of the search result is meant to use the same parameter names.

## Errors

Database errors answer `500` with an English `{ "error": "..." }` message. The frontend shows its own German message
instead.

## Tests

- `backend/tests/timeEntry.model.test.js`: SQL against the real schema in pg-mem, including the `one_running_timer`
  index
- `backend/tests/timeEntry.controller.test.js`: status codes, the one-timer rule, editing, moving, deleting and the
  description handling
- `backend/tests/timeEntry.routes.test.js`: route order and the customer route
- `backend/tests/entryFilter.test.js`, `timeEntry.search.controller.test.js`, `timeEntry.search.routes.test.js` and
  the `TimeEntry.search` tests in `timeEntry.model.test.js`: the search parameters, the 400s, literal matching, time
  zones around midnight and daylight saving time, paging, totals and the login check
