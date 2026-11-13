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
| `roundingMinutes` | `rounding_minutes` | `0`, `5`, `10`, `15`, `30` or `60` (a number) | `0` | The step the hours of an entry are rounded to in reports; 0 is no rounding ([Rounding](reports.md#rounding)) |
| `roundingDirection` | `rounding_direction` | `"up"` or `"nearest"` | `"up"` | Whether an entry is rounded up or to the nearest step; without effect while the step is 0 |
| `showRoundingNote` | `show_rounding_note` | `true` or `false` | `false` | The Reports page and the PDF name the rounding rule in a sentence; without effect while the step is 0 |

The list lives in `backend/src/config/settingsOptions.js`: the name, the column and the check of each option.

## Storage

`backend/migrations/005_settings.sql` creates the table `settings` (`006_settings_show_amounts.sql`, `007_settings_rounding.sql` and `008_settings_rounding_steps.sql` add the columns and the steps): a single row (`id` is always 1, enforced by a
`CHECK`) with one typed column per option, each with its default. The row is created on the first read, so a fresh
install behaves as before and every option has its default until something is saved. `models/Settings.js` creates the row
on first use and updates it.

## Adding an option

1. A migration with `ALTER TABLE settings ADD COLUMN … DEFAULT …` (and `./k8s/generate-init-scripts.sh`).
   The list of rounding steps is in two checks, `settings_rounding_minutes_check` and `customers_rounding_minutes_check`
   (the customer's own rule uses the same steps): a migration that adds a step replaces both, by name.
   Give a `CHECK` an explicit name (`CONSTRAINT settings_<column>_check CHECK (…)`): a later migration has to drop it
   by name, and pg-mem (the tests) names an unnamed check differently from Postgres.
2. An entry in `config/settingsOptions.js` (name, column, `isValid`). `Settings.get()` and `Settings.update()` and the
   controller's validation use that list, so nothing else changes. Column names come only from this list, never from the
   request body: only values can be parameterized, so names taken from the body would allow SQL injection.
3. The option in a group of `frontend/src/settingsGroups.js`, see [Settings page](../ui/settings.md#adding-an-option).

An existing install applies the migration by hand, see [Database](database.md).
