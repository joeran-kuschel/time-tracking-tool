# Customers API

Customers are the top level of the data: each project belongs to one customer.

## Endpoints

All paths are under `/api/customers`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | All customers, sorted by name |
| `GET` | `/:id` | One customer, or `404` |
| `POST` | `/` | Create a customer |
| `PUT` | `/:id` | Replace name and email; set, change or remove the rounding rule and the report language if the body names them |
| `DELETE` | `/:id` | Delete a customer |

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | integer | Generated |
| `name` | text, max. 255 | Required (`400` otherwise) |
| `email` | text, max. 255 | Optional; missing or empty is stored as `null` |
| `rounding_minutes`, `rounding_direction` | smallint, text | The customer's own [rounding rule](reports.md#rounding), see below; both `null` means the global setting (every customer until a rule is set) |
| `report_language` | text | The language of the customer's PDF and CSV reports (`de` or `en`), see [Report language](#report-language); `null` means the language of the app (every customer until one is set) |
| `address`, `tax_id` | text, max. 300 (at most 6 lines) / max. 30 (one line) | The customer's address and tax ID for invoices, see [Details for invoices](#details-for-invoices); `null` when not set |
| `created_at`, `updated_at` | timestamp | Set by the database; `updated_at` changes on `PUT` |

## Details for invoices

`POST` and `PUT` take `address` (a text of 1 to 300 characters with at most 6 lines, separated by `\n`, trimmed) and `taxId`
(1 to 30 characters, one line, trimmed): the customer's address and Steuernummer or USt-IdNr for the invoice
([#114](https://github.com/joeran-kuschel/time-tracking-tool/issues/114)). `null` means not set (every customer until one is
saved). A body that does not mention a field keeps the stored value on `PUT`, so older clients that send only name and
email change nothing. The checks are those of your own address and tax ID in the settings
(`config/settingsOptions.js`); an invalid value answers `400` (`address must be … ` / `taxId must be …`) and nothing is
saved. The answers show them as `address` and `tax_id`. Migration `016_invoice_details.sql` adds the columns.
Nothing prints them yet: the invoice does.

## Report language

`POST` and `PUT` take `reportLanguage`: `"de"` or `"en"` makes the customer's PDF and CSV files always come out in that
language, `null` means the language of the app, which the download request names with `lang` (the default for every
existing customer, so nothing changes with the migration). A body that does not mention `reportLanguage` keeps the
stored value on `PUT` (and means `null` on `POST`); any other value answers `400` (`reportLanguage must be null … or one
of: en, de`) and nothing is saved. The valid languages are `LOCALES` in `src/i18n.js`. Migration
`011_customer_report_language.sql` adds the column with the named check `customers_report_language_check`
(`NULL` or one of the languages); a migration that adds a language replaces it, and a test fails when the check and
`LOCALES` disagree. How reports use it: [Reports API](reports.md#report-language).

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
