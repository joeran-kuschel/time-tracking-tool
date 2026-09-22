# Accessibility

The UI has to meet WCAG 2.2 level AA (see `CLAUDE.md`). This chapter lists what is in place and what is still missing.

## In place

- **Landmarks:** header, navigation (`<nav>`, *Main*), main content (`<main>`), the customer sidebar (`<aside>`) and
  the running timer (a region named *Running timer*). Each page has one `<h1>`: the customer's name on the Dashboard
  (visually hidden *Dashboard* without a customer), a visually hidden *Reports* on the Reports page.
- **Navigation:** the current page is marked with `aria-current="page"` and an underline, not only by color.
- **Language:** `<html lang>` follows the current language; the language buttons carry their own `lang`. See
  [Languages](languages.md).
- **Keyboard:** all controls are buttons, inputs or selects in a logical tab order, with one visible focus ring
  (2 px `accent`, 7.0:1 on the page background). Focus stays on the timer button when the timer starts or stops;
  stopping from the header moves focus to the page content. See [Timer](timer.md).
- **Status and errors:** starting and stopping the timer is announced once through a status region; errors use
  `role="alert"`. On the Reports page, the month name is a polite live region, so the arrow buttons announce the new
  month. See [Error messages](error-messages.md).
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
- **Contrast** (calculated from the colors in [Design](design.md)): white on `accent` (Start, Save, selected project,
  Download PDF) 7.8:1, the hourly rate on the selected project 6.7:1, the selected customer 9.3:1, `muted` text 6.9:1
  on white and 6.1:1 on the page background, links 7.8:1, white on `danger` (Stop, Delete) 6.6:1, error text 6.6:1,
  the edit and delete icons 9.0:1, borders of inputs and buttons 3.7:1 (at least 3:1, WCAG 1.4.11).

## Missing

From the UX review, not fixed yet:

- The project bars in the month summary are hidden from screen readers; the hours next to them carry the information.
  A screen reader user gets no share-of-total, only the hours.

## Testing

- Component tests run automatic checks with axe (`vitest-axe`, `frontend/src/test/axe.js`). jsdom can't render colors,
  so contrast is checked by hand in a real browser.
- New UI parts are checked with the keyboard in the browser before they are committed.
