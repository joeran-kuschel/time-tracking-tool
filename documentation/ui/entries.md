# Entries

The **Entries** page (German: **Einträge**) searches and filters the time entries of **all** customers. It sits in the
main navigation between *Time tracking* and *Reports*. The search runs on the server, see
[Searching entries](../backend/time-entries.md#searching-entries).

## Using it

The page opens with the **current month** selected. Results load right away and again after every change of a filter.

| Filter | What it does |
|---|---|
| *Search in descriptions* (*In Beschreibungen suchen*) | Finds entries whose description contains the text, in any case. `%`, `_` and `\` mean themselves. Applies after a short pause in typing (about 0.3 seconds) and at once on Enter or when the field is emptied. |
| *Customer* (*Kunde*) | Only this customer's entries. |
| *Project* (*Projekt*) | Only this project. Disabled until a customer is chosen; changing the customer clears the project. |
| *Period* (*Zeitraum*) | *Any time* (*Beliebig*), *Today*, *This week* (Monday to Sunday), *Last week*, *This month*, *Last month*, *This year*, *Custom* (*Benutzerdefiniert*). Choosing one fills *From* and *To*. |
| *From* / *To* (*Von* / *Bis*) | The first and last day (included), in the browser's time zone. Either can stay empty. Typing a date switches the period to *Custom*. An entry belongs to the day it starts in. |
| *Sort* (*Sortierung*) | *Newest first* (default) or *Oldest first*. |

Selects and dates apply at once. If *To* is before *From*, both fields are marked invalid, the message *The end date must
not be before the start date* appears and no search is sent; the last results stay.

### Collapsing the filters

The filter form is a disclosure: the heading *Filters* (*Filter*) is a button with a chevron that hides and shows the
fields. It starts expanded and is expanded again whenever the page is opened. Collapsed, the header row stays visible
and shows what is active: the number of active filters, one removable chip per filter (*Search: …*, *Customer: …*,
*Project: …*, *Period: …*, *Sort: …*) and **Reset filters**; without any it says *No filters active*. A chip removes
only its own filter (removing the customer also clears the project; the period goes back to *Any time*, the sort to
*Newest first*). The period and a non-default sort count as active filters, so the preselected month shows as a chip.

### Reset

**Reset filters** (*Filter zurücksetzen*) clears **all** filters: the text, customer, project, the period (back to
*Any time*, **not** back to the current month) and the sort order (back to *Newest first*). The result is all entries,
newest first. It is shown whenever a filter is active, including the preselected month or a non-default sort. Focus then
moves to the search field, or to the *Filters* button when the section is collapsed.

The filters live in the page's state only: they are gone when another page opens, and the page starts with the current
month again. There is no URL state.

## Results

- A status line says how many entries match and their hours, e.g. *12 entries, 31.50 h*, or *No entries found*. The
  count covers all matches, the hours only finished entries (a running entry counts as an entry, with no hours yet).
- The entries are a table: *Date*, *Customer*, *Project*, *Time*, *Hours*, *Description*, *Actions*. Below the `sm`
  breakpoint every row becomes a card whose cells show their column name, so the page reflows at 320 px without
  horizontal scrolling.
- **Open** (*Öffnen*) is a link to the entry's customer and project on the Time tracking
  page (`/time-tracking/3/7`). Entries cannot be edited or deleted here. The link shows only *Open* so rows stay low, but its accessible name continues *Open in Time tracking: customer, day* (German *Öffnen in Zeiterfassung: …*), which contains the visible label (WCAG 2.5.3).
- 50 entries load at first. **Show more** (*Mehr anzeigen*) appends the next 50; *Showing 50 of 120* tells how many
  are shown. When everything is loaded, the button goes away and focus moves to the list.
- While a search runs, the old results stay (marked `aria-busy`), so the list does not jump. If a search fails, an error
  (*Entries could not be loaded.*, `role="alert"`) shows and the old results stay. Only the answer to the latest search
  is used.

## Accessibility

- The form is a `<form role="search">` named *Filter entries*; all fields have visible labels; the page has one `<h1>`
  and a results `<section>` named *Results*.
- The *Filters* toggle is a button inside a heading with `aria-expanded` and `aria-controls`, operable with Enter and
  Space, 44 px high. Focus stays on it when the section collapses; the chevron switches without animation.
- The status line is the only live region (`role="status"`, polite, atomic). It changes once per answer, not on every
  keystroke and not while loading.
- The invalid period is shown with `aria-invalid` and a message linked with `aria-describedby`.
- Table headers use `<th scope="col">`. On narrow screens the table is reflowed with CSS only; some screen readers
  then no longer announce it as a table, but the cell order and the column names (shown in front of each value)
  stay.

## Limits

No highlighting of matches, no page numbers, no status filter and no CSV export yet. The search scans the entries
without an index, see [Searching entries](../backend/time-entries.md#searching-entries).

## Tests

`frontend/tests/pages/Entries.test.jsx` (requests, debounce, stale answers, errors, Show more, Reset, axe in both
languages), `tests/components/EntryFilters.test.jsx` (fields, presets, chips, collapse, Reset),
`tests/filters.test.js`, `tests/hooks/useDebouncedValue.test.js`, `tests/api.test.js` and `tests/App.test.jsx`.
