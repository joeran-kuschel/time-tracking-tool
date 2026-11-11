# Settings API

App-wide options of the tool, shared by every browser. There is one set of settings because there is one user. The
[Settings page](../ui/settings.md) uses it.

## Endpoints

Both need a login like every `/api` route.

| Request | Answer |
|---|---|
| `GET /api/settings` | An object with every option and its value, e.g. `{ "showAmounts": false }` (creates the settings row on the first call). |
| `PUT /api/settings` | Saves the options in the body (any of them) and answers with all options. |

`400` when the body is not an object, or names an option that does not exist or gives it an invalid value (nothing is
saved then). `500` when the database fails.

## Options

| Name | Column | Valid | Default | Meaning |
|---|---|---|---|---|
| `showAmounts` | `show_amounts` | `true` or `false` | `false` | Reports start with hourly rates and amounts ([Reports page](../ui/reports.md)) |

The list lives in `backend/src/config/settingsOptions.js`: the name, the column and the check of each option.

## Storage

`backend/migrations/005_settings.sql` creates the table `settings` (`006_settings_show_amounts.sql` adds the first column): a single row (`id` is always 1, enforced by a
`CHECK`) with one typed column per option, each with its default. The row is created on the first read, so a fresh
install behaves as before and every option has its default until something is saved. `models/Settings.js` creates the row
on first use and updates it.

## Adding an option

1. A migration with `ALTER TABLE settings ADD COLUMN … DEFAULT …` (and `./k8s/generate-init-scripts.sh`).
2. An entry in `config/settingsOptions.js` (name, column, `isValid`). `Settings.get()` and `Settings.update()` and the
   controller's validation use that list, so nothing else changes. Column names come only from this list, never from the
   request body: only values can be parameterized, so names taken from the body would allow SQL injection.
3. The option in a group of `frontend/src/settingsGroups.js`, see [Settings page](../ui/settings.md#adding-an-option).

An existing install applies the migration by hand, see [Database](database.md).
