# Time entries API

Time entries record working time for a project. An entry without `end_time` is a running timer.

## Endpoints

All paths are under `/api/time-entries`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/active` | The running entry with `project_name`, `customer_id` and `customer_name`, or `null` |
| `GET` | `/project/:projectId` | All entries of a project, newest first |
| `GET` | `/customer/:customerId` | All entries of a customer's projects with `project_name`, ordered by project name, then newest first; `[]` for an unknown customer (used by the Time tracking page) |
| `GET` | `/:id` | One entry, or `404` |
| `POST` | `/` | Create an entry (start a timer, or add a finished entry) |
| `PATCH` | `/:id` | Stop a running entry, or edit a finished one |
| `DELETE` | `/:id` | Delete a finished entry |

`/active` is registered before `/:id`, so `active` is never read as an id. A test checks the order.

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

- **Stopping** a running entry: send `endTime` (and optionally `description`). The end is not compared with the start,
  because the browser's clock stops an entry that the server's clock started. Sending `startTime` or `projectId` for a
  running entry answers `409`.
- **Editing** a finished entry: every field can change. The end must be after the start (`400` otherwise).
  `projectId` can only move the entry to another project of the same customer (`400` otherwise).
- Fields left out keep their stored value. For `description`, an empty string or `null` clears it; stopping the timer
  sends no description, so it is kept.
- `404` for an unknown entry.

This is a single `UPDATE` (`backend/src/models/TimeEntry.js`, `update(id, { startTime, endTime, projectId, description })`).

## Deleting entries

`DELETE /:id` deletes a finished entry. The running entry answers `409`: stop the timer first. `404` for an unknown
entry.

## Errors

Database errors answer `500` with an English `{ "error": "..." }` message. The frontend shows its own German message
instead.

## Tests

- `backend/tests/timeEntry.model.test.js`: SQL against the real schema in pg-mem, including the `one_running_timer`
  index
- `backend/tests/timeEntry.controller.test.js`: status codes, the one-timer rule, editing, moving, deleting and the
  description handling
- `backend/tests/timeEntry.routes.test.js`: route order and the customer route
