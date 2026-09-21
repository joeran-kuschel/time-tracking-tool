# Time entries API

Time entries record working time for a project. An entry without `end_time` is a running timer.

## Endpoints

All paths are under `/api/time-entries`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/active` | The running entry with `project_name`, `customer_id` and `customer_name`, or `null` |
| `GET` | `/project/:projectId` | All entries of a project, newest first |
| `GET` | `/:id` | One entry, or `404` |
| `POST` | `/` | Create an entry (start a timer, or add a finished entry) |
| `PATCH` | `/:id` | Set the end time (stop a timer) and optionally the description |
| `DELETE` | `/:id` | Delete an entry |

`/active` is registered before `/:id`, so `active` is never read as an id. A test checks the order.

## Creating entries

Body: `{ projectId, startTime, endTime?, description? }`. `projectId` and `startTime` are required (`400` otherwise).

Only one timer may run at a time. Creating an entry **without** `endTime` while another entry has no `end_time` answers
`409` with `{ "error": "A timer is already running" }`. Entries **with** `endTime` can always be added.

The check runs in the controller, not in the database. Two start requests at exactly the same moment could both pass.
For a single-user tool this is very unlikely. A partial unique index would close the gap:
`CREATE UNIQUE INDEX ON time_entries ((true)) WHERE end_time IS NULL`.

## Updating entries

Body: `{ endTime, description? }`. `endTime` is required (`400` otherwise).

- Without `description` in the body, the stored description is kept. Stopping the timer sends only `endTime`.
- With a description, it replaces the stored one. An empty string or `null` clears it.

This is a single `UPDATE` that sets `description` only when one was sent (`backend/src/models/TimeEntry.js`).

## Errors

Database errors answer `500` with an English `{ "error": "..." }` message. The frontend shows its own German message
instead.

## Tests

- `backend/tests/timeEntry.model.test.js`: SQL against the real schema in pg-mem
- `backend/tests/timeEntry.controller.test.js`: status codes, the one-timer rule and the description handling
- `backend/tests/timeEntry.routes.test.js`: route order
