# Invoices API

An invoice bills one customer for a period. It is made from the customer's time entries of the period, but it does not
need a report and does not change one: the report status is not touched. An invoice never changes after it is created. It
keeps a copy of everything it needs and the PDF that was made, so later changes to the settings, the customer, the entries
or the rates do not alter it ([#114](https://github.com/joeran-kuschel/time-tracking-tool/issues/114)). The page that uses
this API follows in a later change; this chapter is the API.

## Endpoints

All paths are under `/api/invoices` and need a login like every `/api` route. Amounts are strings with two decimals in
euros, like the JSON report; the currency is always `EUR`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/preview` | What an invoice would contain, without taking a number or storing anything |
| `POST` | `/` | Creates the invoice; `201` with its summary |
| `GET` | `/` | All invoices, newest invoice date first (without their PDFs) |
| `GET` | `/:id/pdf` | The stored PDF, unchanged; `?inline=1` opens it in the browser instead of downloading it |
| `DELETE` | `/:id` | Deletes an invoice with its PDF and lines; `204` |

### The request of `/preview` and `POST /`

```json
{ "customerId": 3, "from": "2026-02-01", "to": "2026-02-28", "tz": "Europe/Berlin", "invoiceDate": "2026-03-05", "lang": "de" }
```

- `customerId`: a whole number (or digits as text). `404` when the customer does not exist.
- `from` and `to`: `YYYY-MM-DD`, real days from 1970, `to` included. `from` must not be after `to`, and the period is at
  most 366 days. The entries are those that **start** in these days in the time zone `tz` (the browser's, like the
  reports; unknown or missing means UTC), the same limits as the filters of the Entries page (`dayRange` in `utils/period.js`).
- `invoiceDate`: optional, default today in `tz`. It decides the year of the invoice number.
- `lang`: optional `de` or `en`. The language of the invoice is the customer's own report language, else `lang`, else German.

Anything else answers `400` with the reason (`customerId is required`, `from and to are required as YYYY-MM-DD`, …).

### The answer of `/preview`

`customer { id, name }`, `from`, `to`, `invoiceDate`, `language`, `number` (the number the invoice would get now; not reserved, so it
can differ when the invoice is created), `lines` (one per project: `projectId`, `name`, `minutes`, `hours`, `hourlyRate`,
`amount`), `currency`, `vatMode`, `vatRate`, `net`, `vat`, `gross` and `missing`.

`missing` lists what an invoice still needs, as codes: `senderName`, `senderAddress` and `senderTaxId` (your details in the
[settings](settings.md)), `customerAddress` (the [customer](customers.md#details-for-invoices)) and `noEntries` (no counted time
in the period). The customer's tax ID, your email and your bank details are optional.

### Creating

`POST /` answers `422 { error, missing }` when anything is missing, and takes no number then. Otherwise:

1. The next number is taken from the counter of the year of the invoice date, in one transaction (below).
2. The PDF is made with that number, in the language of the invoice, with your logo.
3. The invoice, its lines and the PDF are stored, and the answer is `201` with the summary: `id`, `number`, `customerId`,
   `customerName`, `invoiceDate`, `periodFrom`, `periodTo`, `language`, `vatMode`, `vatRate`, `currency`, `net`, `vat`,
   `gross` and `createdAt`.

`404` when the customer was deleted while the invoice was being made. Creating is not idempotent: the same customer and period can be
invoiced twice (two requests make two invoices with two numbers), so the page that uses this API should warn first. A timer
that is still running in the period is not billed and does not stop the invoice.

`409` (code `NUMBER_TAKEN`) when the number the pattern makes is already used by another invoice, which can happen after the
pattern was changed; the message says to raise the next invoice number in the settings. Nothing is stored and the counter
is not moved then.

## Lines and amounts

- One line per project, sorted by name. A project with no counted time (for example one whose only entry is still running) is
  left out.
- The hours are those of the report of the same period: whole minutes, with the customer's own rounding rule, else the global
  one ([Rounding](reports.md#rounding)). The amount of an entry is rate × minutes / 60 rounded to cents, and the line adds
  up its entries, so an invoice and a report for the same period show the same numbers (`reportAmounts` in `utils/amounts.js`).
- **Net** is the sum of the lines. **VAT** is net × the rate of the settings / 100, rounded to cents (halves up); for a
  small business (`vatMode` `small_business`) it is 0 and gross equals net. **Gross** is net plus VAT.

## Numbering

The number is made by the pattern of the settings ([Invoice numbers](settings.md#invoice-numbers)) from the counter of the
year of the invoice date. A pattern with a year starts again at 1 every year, one without keeps counting.

Taking a number is one statement (`InvoiceCounter.take`): an upsert that moves the counter on and locks its row, so two
invoices created at the same time get different numbers. It runs in the same transaction as the PDF and the inserts
(`Invoice.create` in `models/Invoice.js`): if anything fails, the transaction is rolled back and the number is not used up,
so a failure leaves no gap. The unique index on `invoices.number` is the second guard.

**Deleting an invoice does not move the counter back**: its number stays used, so numbers are never reused and a deletion
leaves a gap. Keep in mind that an invoice you have sent should be kept; a correction is a credit note, which does not exist yet.

## The PDF

`utils/invoicePdf.js`, built with the report's fonts and sender block (`utils/pdfGenerator.js`), in German or English:

- at the top right your name, address, email and tax ID (*Steuernummer / USt-IdNr.*), at the left your logo if there is one;
- the customer's name, address and tax ID at the left, then the title (*INVOICE* / *RECHNUNG*), the number, the invoice date
  and the service period (*Leistungszeitraum*);
- a table of the lines with the project, the time as `h:mm`, the rate and the amount; a long invoice continues on further
  pages, which repeat the column titles;
- the net amount, the VAT with its rate and the total, or for a small business only the total and the sentence *No VAT is
  charged under section 19 of the German VAT Act (UStG).* (*Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.*);
- your bank details at the end, if you entered them.

The file is stored when the invoice is created and every download returns exactly these bytes, so changing the logo or the
design later does not alter an old invoice. The download is named `invoice-<number>.pdf`, with every character other than
letters, digits, `.`, `_` and `-` (such as `/`) replaced by `_`.

## Storage

`backend/migrations/017_invoices.sql`:

- `invoices`: the unique `number`, `customer_id` (`ON DELETE SET NULL`: deleting a customer keeps its invoices), the dates
  (`invoice_date`, `period_from`, `period_to`), `language`, a copy of the customer (`customer_name`, `customer_address`,
  `customer_tax_id`) and of you (`sender_name`, `sender_address`, `sender_email`, `sender_tax_id`, `sender_bank_details`),
  `vat_mode`, `vat_rate`, the totals in cents (`net_cents`, `vat_cents`, `gross_cents`) and `pdf` (`BYTEA`).
- `invoice_lines`: `invoice_id` (`ON DELETE CASCADE`), `position`, `description` (the project's name), `minutes`,
  `rate_cents` and `amount_cents`.

The hourly backup includes both tables; a PDF is about 15 to 20 KB.

## Tests

`tests/invoicing.test.js` (the request, VAT, the lines, what is missing, the file name), `tests/invoice.model.test.js`
(storage, numbering, the transaction, deleting), `tests/invoiceController.test.js`, `tests/invoicePdf.test.js` (the texts and
positions with a fake pdfkit) and `tests/invoicePdf.real.test.js` (real PDFs), and the routes in `tests/app.test.js`.

The test database (pg-mem) does not roll back a transaction and corrupts bytes from 0x80 on in a `BYTEA` column, so the model
tests use plain-text bytes and a recording pool for the rollback. These were checked once against a real Postgres, as the
logo was: twelve invoices created at the same time got twelve different numbers, the PDF came back byte for byte, a failed
creation left the counter where it was, and deleting a customer kept its invoices.
