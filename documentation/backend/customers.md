# Customers API

Customers are the top level of the data: each project belongs to one customer.

## Endpoints

All paths are under `/api/customers`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | All customers, sorted by name |
| `GET` | `/:id` | One customer, or `404` |
| `POST` | `/` | Create a customer |
| `PUT` | `/:id` | Replace name and email |
| `DELETE` | `/:id` | Delete a customer |

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | integer | Generated |
| `name` | text, max. 255 | Required (`400` otherwise) |
| `email` | text, max. 255 | Optional; missing or empty is stored as `null` |
| `created_at`, `updated_at` | timestamp | Set by the database; `updated_at` changes on `PUT` |

## Behavior

- `PUT` replaces both fields: sending only `name` clears `email`.
- `DELETE` also deletes all projects of the customer and their time entries (`ON DELETE CASCADE`). There is no undo;
  see [Database backups](database-backups.md).
- `PUT` and `DELETE` for an id that doesn't exist answer `200` with an empty body instead of `404`.
- Database errors answer `500` with an English `{ "error": "..." }` message.

## Code

`backend/src/routes/customers.js`, `controllers/customerController.js`, `models/Customer.js`
