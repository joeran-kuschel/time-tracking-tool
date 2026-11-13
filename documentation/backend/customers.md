# Customers API

Customers are the top level of the data: each project belongs to one customer.

## Endpoints

All paths are under `/api/customers`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | All customers, sorted by name |
| `GET` | `/:id` | One customer, or `404` |
| `POST` | `/` | Create a customer |
| `PUT` | `/:id` | Replace name and email; set, change or remove the rounding rule if the body names it |
| `DELETE` | `/:id` | Delete a customer |

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | integer | Generated |
| `name` | text, max. 255 | Required (`400` otherwise) |
| `email` | text, max. 255 | Optional; missing or empty is stored as `null` |
| `rounding_minutes`, `rounding_direction` | smallint, text | The customer's own [rounding rule](reports.md#rounding), see below; both `null` means the global setting (every customer until a rule is set) |
| `created_at`, `updated_at` | timestamp | Set by the database; `updated_at` changes on `PUT` |

## Rounding rule

A customer can have its own rule for rounding the hours of its entries in reports (`POST` and `PUT` take camelCase names, the
rows have the columns above):

| Body | Meaning |
|---|---|
| `roundingMinutes: null, roundingDirection: null` | Use the global setting (the default) |
| `roundingMinutes: 0, roundingDirection: "up"` | No rounding for this customer, although the global setting rounds |
| `roundingMinutes: 15, roundingDirection: "nearest"` | An own rule: a step of 5, 10, 15, 30 or 60 minutes (the steps of the [settings](settings.md)), `"up"` or `"nearest"` |

- `PUT` without the two fields keeps the stored rule, so older clients can still rename a customer. `POST` without them
  uses the global setting.
- Both fields must be given together: only one of them, an unknown step or direction, or a string instead of a number
  answers `400` and saves nothing. The values are checked with the same lists as the settings
  (`config/settingsOptions.js`).
- The database enforces it too: migration `009_customer_rounding.sql` adds the two columns with named checks (both set or
  both empty, the steps and directions). The list of steps is in `customers_rounding_minutes_check` and in
  `settings_rounding_minutes_check`: a migration that adds a step replaces both, and tests fail when a check and
  `config/settingsOptions.js` disagree. Existing customers have neither and so use the global setting.
- The rule that applies to an entry is the one of its customer, otherwise the global one (`utils/rounding.js`,
  `ruleOfEntry`); see [Reports API](reports.md#rounding) for what it does.

## Behavior

- `PUT` replaces name and email: sending only `name` clears `email` (the rounding rule is only changed when named).
- `DELETE` also deletes all projects of the customer and their time entries (`ON DELETE CASCADE`). There is no undo;
  see [Database backups](database-backups.md).
- `DELETE` answers `409` while the running timer belongs to one of the customer's projects. A timer of another customer
  doesn't block it.
- `PUT` and `DELETE` for an id that doesn't exist answer `404`.
- Database errors answer `500` with an English `{ "error": "..." }` message.

## Code

`backend/src/routes/customers.js`, `controllers/customerController.js`, `models/Customer.js`
