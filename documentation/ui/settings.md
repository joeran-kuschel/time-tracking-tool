# Settings

The **Settings** page (German: *Einstellungen*, `/settings`) is the place for options that apply to the whole tool. They
are saved on the server, so they are the same in every browser. The language and the theme stay browser choices in the
header.

## Options

| Group | Option | Default | Effect |
|---|---|---|---|
| **Time and billing** (*Zeit und Abrechnung*) | **Show hourly rate and amounts in reports** (*Stundensatz und Beträge in Berichten anzeigen*) | off | The checkbox on the [Reports page](reports.md) starts from it; ticking it there changes only that visit. |
| | **Round time entries** (*Zeiteinträge runden*) | no rounding | **No rounding**, **5 minutes**, **10 minutes**, **Quarter hour (15 minutes)**, **Half hour (30 minutes)** or **Hour (60 minutes)** (German: *5 Minuten*, *10 Minuten*, *Viertelstunde*, *Halbe Stunde*, *Stunde*): the hours of each entry are rounded in reports ([Reports](reports.md#rounded-hours)). |
| | **Direction** (*Richtung*) | up | **Up** (*Aufrunden*) or **To the nearest** (*Auf- oder abrunden (nächstgelegene Stufe)*). Disabled while the step is *No rounding*, with a hint that says why. |
| | **Default hourly rate for new projects (€)** (*Standard-Stundensatz für neue Projekte (€)*) | empty (no default) | The form for a new project on the [Time tracking](time-tracking.md) page starts with this rate, which stays editable there. Existing projects and the amounts of existing reports never change with it. |
| | **Name the rounding rule in reports** (*Rundungsregel in Berichten nennen*) | off | Adds a sentence such as *Hours rounded up to quarter hours.* to the Reports page and the PDF. Disabled while the step is *No rounding*, with a hint that says why. |
| **Your details** (*Deine Angaben*) | **Logo** (*Logo*) | none | A PNG or JPEG of up to 1 MB and 2000 × 2000 pixels, printed at the top left of the PDF report. It is stored **as soon as you choose it** (not with Save), with a polite message *Logo saved.*; the preview has the text alternative *Your logo*, and **Remove logo** removes it at once (*Logo removed.*). |
| | **Your name or business name** (*Dein Name oder Firmenname*) | empty | Printed in bold at the top right of the PDF report ([Reports](reports.md)). One line, up to 100 characters. |
| | **Address** (*Adresse*) | empty | Printed under the name, one line per line you type. Up to 6 lines and 300 characters. |
| | **Email address** (*E-Mail-Adresse*) | empty | Printed under the address. Only the format is checked (`name@example.com`), not whether the address exists. |
| | **Tax ID** (*Steuernummer*) | empty | Your Steuernummer or USt-IdNr, one line, up to 30 characters. It is stored for invoices; reports do not print it. |
| **Invoicing** (*Rechnungen*) | **VAT** (*Umsatzsteuer*) | regular | **Regular, with VAT** (*Regulär, mit Umsatzsteuer*) or **Small business, no VAT (§19 UStG)** (*Kleinunternehmer, ohne Umsatzsteuer (§19 UStG)*). |
| | **VAT rate** (*Umsatzsteuersatz*) | 19 % | **19 %**, **7 %** or **0 %**. Disabled for a small business, with a hint that says why. |
| | **Invoice number pattern** (*Muster der Rechnungsnummer*) | `{YYYY}-{NNNN}` | Text with the placeholders `{YYYY}` (year), `{YY}` (short year), `{MM}` (month) and exactly one counter such as `{NNNN}` (four digits, with leading zeros). Besides them only letters, digits and `. _ / -` and spaces. Up to 40 characters. |
| | **Next invoice number** (*Nächste Rechnungsnummer*) | 1 | The counter of the next invoice, a whole number from 1 to 99,999,999. It can only be raised, so a number is never used twice (the backend answers `409`; the page says *The next invoice number can only be raised, not lowered.*). If the pattern has a year, the counter starts again at 1 every year; the field shows the counter of the current year. A live preview under it shows the number (*The next invoice would get the number: 2026-0001*), in a polite live region. |
| | **Bank details** (*Bankverbindung*) | empty | Your IBAN, BIC and bank for the invoice: a multi-line field of up to 4 lines and 300 characters (*Use at most 4 lines.* otherwise). Trimmed, and empty is saved as *not set*. |
| **Calendar** (*Kalender*) | **First day of the week** (*Erster Tag der Woche*) | Monday | **Monday** (*Montag*) or **Sunday** (*Sonntag*): the day the weeks of the [Dashboard](dashboard.md#first-day-of-the-week) and the period choices *This week* and *Last week* on the [Entries page](entries.md) start on. Months and reports stay calendar months. |

A customer can have its own rule (or none) in its form, which then wins over this setting
([Time tracking](time-tracking.md#customers)). Rounding applies to the billing numbers: the reports, the Dashboard's billing figures and the month summary on the Time
tracking page ([Dashboard](dashboard.md#rounded-hours)).

The group has a note: the rounding also applies to the reports of past months; PDF and CSV files that were already
downloaded do not change. Stored entries are never changed, and the timer, the entry lists and the Entries search keep
showing the exact times.

The **Invoicing** group has a note: invoices can be created in a later version, and nothing else changes. The three
settings are only stored until then; the pattern and the counter are described in the [Settings API](../backend/settings.md#invoice-numbers).

Your details are optional: leave them all empty and the report has no sender block, as before. The group has a note that
says where they are printed and that the CSV does not change. Without a logo and details the report has no sender block.
With no group at all the page says
*There are no options yet.*

## Groups and saving

- **Groups:** `src/settingsGroups.js` is the list of groups (`id`, translated `label`, `options`) in the order they are
  shown, and the page is built from it. A group is a `fieldset` with a `legend`, one below the other on the same page. A
  group with no options is not shown. The file explains the shape of an option.
- **Group note and linked fields:** a group can have a `note` shown below its options. An option can have
  `disabledWhen(values)` (from the current form values, so before saving) and a `disabledHint` that replaces its hint
  while it is disabled: a disabled select is described by the reason (`aria-describedby`).
- **Fields:** `components/SettingField.jsx` renders an option with a visible label and an optional hint under it, which the
  field is described by (`aria-describedby`). The types are `checkbox`, `select` (the value of a choice can be a string or a number) and `decimal`; a new type is
  added there together with the first option that needs it.
- **Logo (`logo`):** `components/LogoField.jsx`. A visible label, a file field (`accept="image/png,image/jpeg"`) described by
  its hint and error, the preview (loaded from the server as a file and shown from memory, so a changed logo is never a cached
  one; after storing, the logo is loaded back, so the preview is what is stored and not the file that was chosen) and
  **Remove logo**. Unlike the other options it does not use the Save button: choosing a file stores it at once, as base64
  in a JSON body (`PUT /api/settings/logo`, see [Settings API](../backend/settings.md#logo)). The browser checks the type
  and size first, so the error names the limit without a request (*Choose a PNG or JPEG image. Other types, such as SVG,
  are not accepted.* / *The logo is larger than 1 MB. Choose a smaller file.*); an answer of `400` or `413` adds the
  limits as a hint, and the old logo stays. Errors use `role="alert"`, successes a polite `role="status"`. After
  **Remove logo** the focus moves to the file field, since the button is gone, and a second click while it runs sends one
  request. The image of a removed or replaced logo is released (`URL.revokeObjectURL`).
- **Text fields (`text`, `textarea`, `email`):** a text field, a multi-line one, and one with the email keyboard, each
  with a visible label, an optional hint, `maxLength` and an `autocomplete` token (`name`, `street-address`, `email`) so
  browsers and assistive tools know what the field is (WCAG 1.3.5). The page keeps the typed text until **Save**, then
  trims it and sends `null` for an empty one (*not set*); spaces only are no change. An email that is not
  `something@something.tld` shows *Enter an email address like name@example.com.* and an address with more than 6 lines
  *Use at most 6 lines.* next to the field, with the focus on it, and nothing is saved, as for an amount.
- **Whole number (`integer`) and preview:** a text field with the numeric keyboard (`inputmode="numeric"`) that accepts
  digits for 1 to 99,999,999; anything else shows *Enter a whole number from 1 to 99,999,999.* next to the field (as for an
  amount). An option can have `preview(values)` and `previewLabel`: the text under the field is built live from the
  values the form shows now (`previewInvoiceNumber` in `src/invoiceNumber.js`, which follows the backend's rules, with
  UTC dates like the backend). It sits in a `aria-live="polite"` paragraph that is always in the page, so a screen reader
  announces a change, and it is empty while the pattern or number cannot be used.
- **Text check (`check`):** a text option can have `check(text)`, which returns `null` or a kind of problem. The invoice
  number pattern uses it, and it must pass also when empty (an empty pattern is refused, not saved as *not set*): *Enter a
  pattern of up to 40 characters, without a space at the start or end.*, *Besides the placeholders, use only letters,
  digits and . _ / - and spaces.* or *The pattern needs exactly one counter, for example {NNNN}.*
- **Amount field (`decimal`):** a text field with the decimal keyboard (`inputmode="decimal"`), not `type="number"`, so
  the number is shown and read in the format of the active language: `80,00` in German, `80.00` in English
  (`formatDecimal` and `parseDecimal` in `src/format.js`). It accepts digits with one decimal separator of the language
  and at most two decimals, no sign and no thousands separator; empty means no value (`null`). The page keeps the typed
  text until **Save**. If it is not an amount, the field shows an error below it (*Enter an amount from 0 with up to two
  decimals, for example 80,00.*), is marked `aria-invalid` and described by the error, receives the focus, and nothing is
  saved, not even the other changes; typing in the field removes its error.
- **One Save button:** the page has one **Save** button for all groups, and no autosave. Pressing it sends one
  `PUT /api/settings` with only the options that changed ([Settings API](../backend/settings.md)). A field changed and
  changed back is not a change.
- **Feedback:** the live region (`role="status"`) next to the button says *Settings saved.* after a save, or *Nothing has
  changed.* when there was nothing to send (no request is made). It is cleared by the next change. A failed save shows an
  `ErrorMessage` (`role="alert"`) and keeps what was typed, so pressing **Save** again sends it again
  ([Error messages](error-messages.md)).
- **Loading:** `App` loads the settings once (`hooks/useSettings.js`) and passes them to the page, so a saved change
  applies on every page without a reload. While they load the page says *Loading...*; if loading fails it shows the error
  with a **Try again** button that stays in place (disabled while it loads), so keyboard focus is not lost.
- **Language:** switching the language does not reload the page and keeps what was typed.

## Navigation

The last item of the main navigation, see [Navigation and addresses](navigation.md). Like every page it sets the page
title (*Settings · Time Tracking*) and moves focus to its `<h1>` when it is opened from the navigation.

## Adding an option

1. The backend part: see [Settings API](../backend/settings.md#adding-an-option).
2. An entry in a group of `settingsGroups.js` (or a new group), with the texts as `msg` descriptors; then
   `npm run extract` and the German texts.
3. Tests with the new option; the page tests use their own test groups.

## Tests

`tests/pages/Settings.test.jsx` (groups, the Invoicing group, hint, one save with several changes, only the changes are sent, nothing changed,
failed save and load, language switch, axe in German and English), `tests/hooks/useSettings.test.js`, `tests/invoiceNumber.test.js` (the pattern rules, the same table as the backend), `tests/routes.test.js`,
`tests/api.test.js` and `tests/App.test.jsx` (the navigation item, the settings are loaded once).
