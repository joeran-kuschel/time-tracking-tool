# Invoices

The **Invoices** page (German: *Rechnungen*, `/invoices`, between *Reports* and *Settings*) makes an invoice for a
customer and a period, and lists the invoices that were made. It is the page of the [Invoices API](../backend/invoices.md);
an invoice does not need a report and does not change one.

## New invoice

- **Form:** a **Customer** select (*Kunde*), **From** and **To** (*Von*, *Bis*) and **Invoice date** (*Rechnungsdatum*),
  all with visible labels; the days are native date inputs. The period starts as the whole previous month, and the invoice
  date as today. The invoice date decides the year of the [invoice number](../backend/settings.md#invoice-numbers).
- **Period errors:** a missing or impossible day (*Enter the first and the last day of the period.*), a first day after the
  last (*The first day must not be after the last day.*) or more than 366 days (*The period can be at most 366 days.*) show an
  error (`role="alert"`) below the fields, mark From and To `aria-invalid` and describe them by it. Nothing is asked of the
  backend then. A missing invoice date shows *Enter the invoice date.*
- **Preview:** choosing a customer loads the preview by itself, and so does every change of the customer, a day, the invoice
  date or the language, like the report loads on the Reports page (only the answer for the current choice is shown). It shows:
  - the customer, the period and the invoice date, the number the invoice would get (*given when you create the invoice*, so
    it is not reserved) and the language of the invoice: the customer's own report language, else the app's;
  - a table with one line per project (project, hours as `h:mm`, rate, amount) and below it the net amount, the VAT with its
    rate and the total. For a small business only the total, and the sentence about §19 UStG. A status line that is always on the page (visually hidden) says the total when the preview is there (*The invoice would be 1.359,58 € in total.*).
- **What is missing:** if the preview says something is missing, an alert (*This invoice cannot be created yet:*) lists it, each
  with a link to where to put it right: your name, address and tax ID (*Open Settings*), the customer's address (*Open customer*,
  on the Time tracking page), or no entries in the period (no link). **Create invoice** is then marked `aria-disabled`, says
  why (*Put right what is missing first.*) and does nothing.
- **An invoice that already covers the period:** if the customer has an invoice whose period overlaps the chosen one, a notice
  names it (*Invoice 2026-0004 covers 01.01.2026 to 31.01.2026.*). It only warns: creating stays possible, because a second
  invoice for the same period can be right (an additional service, a correction). Right after you created an invoice, the notice
  does not name that one; it comes back when you change the customer or a day.
- **Creating:** **Create invoice** first asks in place (a group like the one for deleting, but not red): *Create invoice
  2026-0007 for Muster GmbH over 1.359,58 €? The number is used up and the invoice cannot be changed.* Focus starts on
  **Cancel**, Escape cancels, and a second click while it runs sends one request. Then a polite message says *Invoice 2026-0007
  created.*, the list reloads, and focus moves to the **Download** button of the new invoice.
- **When creating fails** the question closes, the form stays, the preview loads again, and the focus moves to the error, which says why: the number is already used (`409`, with a link to
  Settings: raise the next invoice number there), something is missing (`422`; the preview loads again and shows the list),
  the customer is gone (`404`), or *Please try again.* / *The server is not reachable.* The error goes away when you change the customer or a day.

## Created invoices

A table of the invoices, newest invoice date first: number, date, customer (a customer that was deleted since shows *(deleted)*
after its name), period and total. Per invoice:

- **Open** is a link that opens the stored PDF in a new tab (`rel="noopener noreferrer"`), **Download** saves the same file
  (one download at a time; the file name is the backend's, `invoice-<number>.pdf`), and the trash button deletes. The buttons
  have the number in their names (*Download PDF of invoice 2026-0004*), and the visible texts are part of those names.
- **Delete** asks in place first: *Delete invoice 2026-0004? Its number stays used and is never reused. An invoice you have sent
  should be kept.* Focus starts on **Cancel**. After deleting, a polite message says so, the list and the preview load again, and
  focus moves to the heading of the list. A failed deletion shows its error in the question and keeps the invoice.
- With no invoices the page says *No invoices yet.*; while loading, *Loading...*; when loading fails, an error with a **Try again**
  button that stays in place. The form works without the list, but then the notice about an invoice that already covers the period
  has nothing to compare with.

The table scrolls sideways on a narrow screen. The page is available in German and English, and switching the language does not
reload it (the preview loads again, so the invoice's language follows).

## Code

`pages/Invoices.jsx` holds the state and the calls; `components/invoices/` has `InvoicePreview`, `MissingDetails` and `InvoiceList`,
and `components/ConfirmAction.jsx` is the question before creating (focus on Cancel, Escape cancels). The rules apart from the page
(the default period, whether a period is valid, which invoices overlap, how a day is written) are in `src/invoices.js`. The API
calls are `previewInvoice`, `createInvoice`, `getInvoices`, `deleteInvoice`, `downloadInvoicePdf` and `invoicePdfUrl` in `src/api.js`;
they send the browser's time zone like the reports do.

## Tests

`tests/pages/Invoices.test.jsx` (the form, the preview, the period, what is missing, the overlap notice, creating and its errors,
the list, open and download, deleting, both languages, axe), `tests/invoices.test.js`, `tests/components/ConfirmAction.test.jsx`,
`tests/api.test.js` (the invoice calls and the file name) and `tests/routes.test.js` / `tests/App.test.jsx` (the page and its
navigation item).
