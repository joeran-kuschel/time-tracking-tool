# Projects API

A project belongs to a customer and has an hourly rate. Time entries are recorded per project.

## Endpoints

All paths are under `/api/projects`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/customer/:customerId` | All projects of a customer, sorted by name |
| `GET` | `/:id` | One project, or `404` |
| `POST` | `/` | Create a project |
| `PUT` | `/:id` | Replace name and hourly rate |
| `DELETE` | `/:id` | Delete a project |

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | integer | Generated |
| `customer_id` | integer | Required on create as `customerId` (`400` otherwise) |
| `name` | text, max. 255 | Required (`400` otherwise) |
| `hourly_rate` | decimal (10, 2) | Sent as `hourlyRate`: a number of at least 0 (`400` otherwise). Missing on create means `0.00`. Returned as a string, e.g. `"80.00"` |
| `created_at`, `updated_at` | timestamp | Set by the database |

## Behavior

- Creating a project for a customer that doesn't exist answers `400` (`Customer not found`); the controller looks the customer up before inserting. A `customerId` that is not a whole number answers `400` the same way.
- `PUT` without `hourlyRate` keeps the stored rate.
- `DELETE` also deletes the project's time entries (`ON DELETE CASCADE`). It answers `409` while the running timer
  belongs to the project.
- `PUT` and `DELETE` for an id that doesn't exist answer `404`.
- The hourly rate is used by the monthly reports when they are asked for amounts (`amounts=1`), see [Reports](reports.md#amounts).

## Code

`backend/src/routes/projects.js`, `controllers/projectController.js`, `models/Project.js`
