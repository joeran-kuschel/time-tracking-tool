# Accessibility

The UI has to meet WCAG 2.2 level AA (see `CLAUDE.md`). This chapter lists what is in place and what is still missing.

## In place

- **Landmarks:** header, navigation (`<nav>`, *Main*), main content (`<main>`), the customer sidebar (`<aside>`) and
  the running timer (a region named *Running timer*). Each page has one `<h1>`: *Dashboard* on the Dashboard, the customer's name on the Time tracking page
  (visually hidden *Time tracking* without a customer), a visually hidden *Reports* on the Reports page.
- **Navigation:** the current page is marked with `aria-current="page"` and an underline, not only by color.
- **Language:** `<html lang>` follows the current language; the language buttons carry their own `lang`. See
  [Languages](languages.md).
- **Keyboard:** all controls are buttons, inputs or selects in a logical tab order, with one visible focus ring
  (2 px `accent`, 7.0:1 on the page background). Focus stays on the timer button when the timer starts or stops;
  stopping from the header moves focus to the page content. See [Timer](timer.md).
- **Status and errors:** starting and stopping the timer is announced once through a status region; errors use
  `role="alert"`. On the Reports page, the month name is a polite live region, so the arrow buttons announce the new
  month. See [Error messages](error-messages.md).
- **Dashboard:** the *Track time* tabs follow the WAI-ARIA tabs pattern (arrow keys, Home, End); the chart is one tab
  stop whose bars are read with the arrow keys into a polite live region, and a visually hidden table lists the same
  values; **Preview PDF** links say that they open a new tab. See [Dashboard](dashboard.md).
- **Labels:** all fields have visible labels (`RecordForm`, the timer, the Reports page); edit forms are grouped with a
  legend such as *Edit customer*. The month buttons on the Reports page are a group named *Month*.
  Validation errors mark their field with `aria-invalid` and are linked with `aria-describedby`.
- **Selection:** the selected customer and project are marked with `aria-pressed`, not only by color. The customer of
  the running timer has a red dot and *, timer running* in its button name.
- **Editing and deleting:** forms and confirmations open in place and take focus; closing them returns focus to the
  button that opened them; Escape cancels.
- **Dialogs:** adding uses modal dialogs on the native `<dialog>` element. The browser keeps focus inside and makes the
  page behind inert; the dialog is named by its heading (`aria-labelledby`). Opening focuses the first field, closing
  (Save, Cancel, Escape) returns focus to the opening button. The backdrop doesn't close it, so no input is lost by a
  stray click. Tab past the last button moves focus to the browser's toolbar, not to the page, as with every native
  modal dialog.
- **Icon buttons:** edit and delete show only an icon, which is hidden from screen readers (`aria-hidden`). The button's
  `title` names the record, e.g. *Edit Muster GmbH*: it is the tooltip and the accessible name. There is deliberately no
  `aria-label` as well, so the title isn't exposed a second time as a description. The buttons are 32 × 32 px (at least
  24 × 24 px, WCAG 2.5.8); the month arrows use the same `title` pattern and are 44 px wide.
- **Contrast**, measured in the browser from the theme colors in [Design](design.md), light / dark:
  text on cards 17.0 / 13.8:1; `muted` text 6.9 / 6.6:1 on cards and 6.1 / 7.2:1 on the page background; text on
  `accent` (Start, Save, selected project, Download PDF) 7.8 / 7.9:1; links 7.8 / 6.7:1; the selected customer
  9.3 / 8.4:1; text on `danger` (Stop, Delete) 6.6 / 5.8:1; red text (errors, *running*) 6.6 / 5.0:1 on cards and
  5.8 / 4.6:1 inside a delete confirmation; borders of inputs and buttons 3.7 / 3.4:1 (at least 3:1, WCAG 1.4.11);
  the focus ring 7.0 / 7.4:1. Hover colors keep at least 7.4:1 in both themes.
- **Theme switch:** a group named *Theme* with three icon buttons named by their `title` (*Light*, *Dark*, *Like the
  system*); the active one is marked with `aria-pressed`. The dark theme sets `color-scheme: dark`, so native controls
  stay readable.

## Missing

From the UX review, not fixed yet:

- The project bars in the month summary are hidden from screen readers; the hours next to them carry the information.
  A screen reader user gets no share-of-total, only the hours.

## Testing

- Component tests run automatic checks with axe (`vitest-axe`, `frontend/src/test/axe.js`). jsdom can't render colors,
  so contrast is checked by hand in a real browser.
- New UI parts are checked with the keyboard in the browser before they are committed.
