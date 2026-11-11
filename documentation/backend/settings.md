# Settings API

App-wide options of the tool, shared by every browser. There is one set of settings because there is one user. The
[Settings page](../ui/settings.md) uses it.

## Endpoints

Both need a login like every `/api` route.

| Request | Answer |
|---|---|
| `GET /api/settings` | An object with every option and its value (creates the settings row on the first call). `{}` while there are no options. |
| `PUT /api/settings` | Saves the options in the body (any of them) and answers with all options. |

`400` when the body is not an object, or names an option that does not exist or gives it an invalid value. `500` when
the database fails.

## Storage

`backend/migrations/005_settings.sql` creates the table `settings`: a single row (`id` is always 1, enforced by a
`CHECK`) with one typed column per option, each with its default. The row is created on the first read, so a fresh
install behaves as before and every option has its default until something is saved. `models/Settings.js` reads and
upserts the row.

## Adding an option

1. A migration with `ALTER TABLE settings ADD COLUMN … DEFAULT …` (and `./k8s/generate-init-scripts.sh`).
2. A validator for it in `VALIDATORS` in `controllers/settingsController.js`.
3. The column in the `INSERT … ON CONFLICT` of `Settings.update`. Column names come from a fixed list in the model,
   never from the request body: only values can be parameterized, so names taken from the body would allow SQL injection.
4. The option in a group of `frontend/src/settingsGroups.js`, see [Settings page](../ui/settings.md#adding-an-option).

An existing install applies the migration by hand, see [Database](database.md).
