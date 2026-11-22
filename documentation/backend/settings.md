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
saved then). `409` (code `COUNTER_LOWERED`) when `invoiceNextNumber` is lower than the current number of its counter; nothing of the request is
saved then. `500` when the database fails.

## Options

| Name | Column | Valid | Default | Meaning |
|---|---|---|---|---|
| `showAmounts` | `show_amounts` | `true` or `false` | `false` | Reports start with hourly rates and amounts ([Reports page](../ui/reports.md)) |
| `roundingMinutes` | `rounding_minutes` | `0`, `5`, `10`, `15`, `30` or `60` (a number) | `0` | The step the hours of an entry are rounded to in reports; 0 is no rounding ([Rounding](reports.md#rounding)) |
| `roundingDirection` | `rounding_direction` | `"up"` or `"nearest"` | `"up"` | Whether an entry is rounded up or to the nearest step; without effect while the step is 0 |
| `showRoundingNote` | `show_rounding_note` | `true` or `false` | `false` | The Reports page and the PDF name the rounding rule in a sentence; without effect while the step is 0 |
| `weekStart` | `week_start` | `"monday"` or `"sunday"` | `"monday"` | The day the weeks of the Dashboard and the *This week* and *Last week* choices of the Entries page start on. The server does not use it: months and reports stay calendar months ([Settings page](../ui/settings.md)) |
| `senderName` | `sender_name` | `null` or a text of 1 to 100 characters, one line, trimmed | `null` | Your name or business name for the sender block of the PDF report ([Reports](reports.md#pdf-report)) |
| `senderAddress` | `sender_address` | `null` or a text of 1 to 300 characters with at most 6 lines (separated by `\n`), trimmed | `null` | Your address for the sender block; one printed line per line |
| `senderEmail` | `sender_email` | `null` or an email address of at most 254 characters, in the format `something@something.tld` only | `null` | Your email address for the sender block |
| `senderTaxId` | `sender_tax_id` | `null` or a text of 1 to 30 characters, one line, trimmed | `null` | Your Steuernummer or USt-IdNr, kept for invoices (reports do not print it) |
| `vatMode` | `vat_mode` | `"regular"` or `"small_business"` | `"regular"` | VAT for invoices: with VAT, or none under §19 UStG. Nothing reads it yet |
| `vatRate` | `vat_rate` | `0`, `7` or `19` (a number) | `19` | The VAT rate in percent for `"regular"` |
| `invoiceNumberPattern` | `invoice_number_pattern` | a [pattern](#invoice-numbers) of up to 40 characters | `"{YYYY}-{NNNN}"` | The format of invoice numbers |
| `invoiceNextNumber` | none (table `invoice_counters`) | a whole number from 1 to 99999999 | `1` | The next invoice number of the counter the pattern uses today; only ever raised (see below) |
| `defaultHourlyRate` | `default_hourly_rate` | `null` or a number from 0 to 99999999.99 with at most two decimals (a number, not a string) | `null` | The hourly rate (euros) that the form for a new project starts with; `null` is no default. Nothing else reads it: existing projects and report amounts never change with it ([Projects](projects.md)) |

The list lives in `backend/src/config/settingsOptions.js`: the name, the column and the check of each option, and
optionally `fromColumn`, which turns what `pg` returns into the API value (a `DECIMAL` column comes back as a string, so
the rate becomes a number).

## Invoice numbers

The pattern is text with the placeholders `{YYYY}` (year), `{YY}` (year of two digits), `{MM}` (month) and exactly one counter,
a run of `N` such as `{NNNN}` (up to 8; four digits with leading zeros). The rest is letters, digits and `. _ / -`, and
spaces inside, up to 40 characters in all. `utils/invoiceNumber.js` checks a pattern (`patternProblem`), formats a number
(`formatInvoiceNumber`, with a UTC date) and says which counter a date uses (`counterScope`); the frontend has the same
rules for its preview (`frontend/src/invoiceNumber.js`) and both test files use the same table of examples.

The counters are in the table `invoice_counters` (`015_settings_invoicing.sql`): one row per `scope_year` with its
`next_number`. A pattern **with a year** restarts at 1 every year, so its counter is the year of the invoice date; a
pattern without a year keeps counting, with `scope_year` 0. A counter without a row is at 1, so a new year needs no
action. `GET` shows the counter of today's year (UTC) for the saved pattern. `PUT` with `invoiceNextNumber` sets the
counter of the pattern saved with it (or the saved one), and refuses a lower number than the counter has, so a number
is never used twice (the check is part of the `UPDATE ... WHERE next_number <= ...` that writes it, so two saves at the same
time cannot lower it; the counter is raised before the other options are saved, so a failed save can only skip numbers); changing only the pattern moves no counter, and a pattern without a year starts its own counter at 1,
so raise it first when you already used such numbers. Nothing creates invoices yet: the invoice will take its number from
this counter in one atomic step and a unique index on the invoice number is the second guard.

## Logo

Your logo for the sender block of the PDF report ([Reports](reports.md#pdf-report)). It is not an option of the table
above: it has its own table and its own routes, and `GET /api/settings` never carries it.

| Request | Answer |
|---|---|
| `GET /api/settings/logo` | The image itself, with its `Content-Type` (`image/png` or `image/jpeg`), `X-Content-Type-Options: nosniff` and `Cache-Control: no-store`. `404` when there is no logo. |
| `PUT /api/settings/logo` | Stores `{ "contentType": "image/png", "data": "<base64>" }`, replacing the old logo, and answers `{ contentType, bytes }`. `400` with `{ error, code }` when the image is refused, `413` when the body is larger than 1.5 MB. |
| `DELETE /api/settings/logo` | Removes it; `204`, also when there was none. |

All three need a login. `utils/logoImage.js` (`checkLogo`) refuses an upload with `400` and a `code` that says why:

- **`LOGO_INVALID`:** the content type is not `image/png` or `image/jpeg` (SVG is refused: it can carry scripts and the PDF
  library does not draw it), `data` is not base64, the first bytes of the file are not those of the stated type (the type
  is read from the bytes, not trusted), the header gives no size, the picture data of a PNG inflates to more (or less)
  than its header says, or the PDF library cannot embed the image (checked by drawing it into a throwaway document,
  which reads and decodes the whole picture). The data check stops a decompression bomb: a small PNG can hold gigabytes
  of zeros, which the PDF library would inflate in memory. The inflating is capped at the size the header allows.
- **`LOGO_TOO_LARGE`:** the image is more than 1 MB (1,048,576 bytes).
- **`LOGO_DIMENSIONS`:** more than 2000 × 2000 pixels, read from the PNG header or the JPEG frame header. A small file can
  decompress to a huge picture, so the size in pixels is limited as well.

**Body size.** The image travels as base64 in a JSON body, a third larger than the file: 1 MB is about 1.4 MB. Every other
route keeps the default limit of 100 kB. In `app.js` the global parser skips this one path, and its own parser with a limit
of 1.5 MB runs *after* the login check, so nobody can make the server read a large body without a session. The proxies
in front must let it through too, as both refuse more than 1 MB by default: `location = /api/settings/logo` in
`frontend/nginx.conf` has `client_max_body_size 2m`, and `k8s/ingress.yaml` has the annotation
`nginx.ingress.kubernetes.io/proxy-body-size: "2m"`. Without them a logo of more than about 700 kB fails with `413` in
the cluster, although it works in the dev server. JSON-only bodies stay the rule (no multipart upload, no new
dependency), which keeps other websites from using the session with a plain HTML form.

## Storage

`backend/migrations/005_settings.sql` creates the table `settings` (`006_settings_show_amounts.sql`, `007_settings_rounding.sql`, `008_settings_rounding_steps.sql` and `010_settings_default_hourly_rate.sql`, `012_settings_week_start.sql`, `013_settings_sender_details.sql` and `015_settings_invoicing.sql` add the columns and the steps): a single row (`id` is always 1, enforced by a
`CHECK`) with one typed column per option, each with its default. The row is created on the first read, so a fresh
install behaves as before and every option has its default until something is saved. `models/Settings.js` creates the row
on first use and updates it.

The logo is in the table `sender_logo` (`014_sender_logo.sql`): one row (`id` is always 1) with `content_type`, `data` (`BYTEA`) and
`updated_at`, so reading the settings never loads the image. No row means no logo. `models/Logo.js` reads, replaces and
removes it. The hourly backup includes it (up to about 1 MB more).

## Adding an option

1. A migration with `ALTER TABLE settings ADD COLUMN … DEFAULT …` (and `./k8s/generate-init-scripts.sh`).
   The list of rounding steps is in two checks, `settings_rounding_minutes_check` and `customers_rounding_minutes_check`
   (the customer's own rule uses the same steps): a migration that adds a step replaces both, by name.
   Give a `CHECK` an explicit name (`CONSTRAINT settings_<column>_check CHECK (…)`): a later migration has to drop it
   by name, and pg-mem (the tests) names an unnamed check differently from Postgres. pg-mem also fails ("Corrupted
   alias") on a check written inside `ADD COLUMN IF NOT EXISTS` for a column without `NOT NULL DEFAULT`, so add such a
   check separately (`DROP CONSTRAINT IF EXISTS`, then `ADD CONSTRAINT`), as `010` does.
2. An entry in `config/settingsOptions.js` (name, column, `isValid`; `counter: true` instead of a column for the invoice counter, which `models/Settings.js` handles apart). `Settings.get()` and `Settings.update()` and the
   controller's validation use that list, so nothing else changes. Column names come only from this list, never from the
   request body: only values can be parameterized, so names taken from the body would allow SQL injection.
3. The option in a group of `frontend/src/settingsGroups.js`, see [Settings page](../ui/settings.md#adding-an-option).

An existing install applies the migration by hand, see [Database](database.md).
