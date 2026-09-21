# Accessibility

The UI has to meet WCAG 2.2 level AA (see `CLAUDE.md`). This chapter lists what is in place and what is still missing.

## In place

- **Landmarks:** navigation (`<nav>`) and main content (`<main>`).
- **Language:** `<html lang>` follows the current language; the language buttons carry their own `lang`. See
  [Languages](languages.md).
- **Keyboard:** all controls are buttons, inputs or selects in a logical tab order, with the browser's visible focus
  ring. Focus stays on the timer button when the timer starts or stops. See [Timer](timer.md).
- **Status and errors:** starting and stopping the timer is announced once through a status region; errors use
  `role="alert"`. See [Error messages](error-messages.md).
- **Labels:** all Dashboard fields have visible labels (`RecordForm`), grouped with a legend such as *New customer*.
  Validation errors mark their field with `aria-invalid` and are linked with `aria-describedby`.
- **Selection:** the selected customer and project are marked with `aria-pressed`, not only by color.
- **Editing and deleting:** forms and confirmations open in place and take focus; closing them returns focus to the
  button that opened them; Escape cancels.
- **Dialogs:** adding uses modal dialogs on the native `<dialog>` element. The browser keeps focus inside and makes the
  page behind inert; the dialog is named by its heading (`aria-labelledby`). Opening focuses the first field, closing
  (Save, Cancel, Escape) returns focus to the opening button. The backdrop doesn't close it, so no input is lost by a
  stray click. Tab past the last button moves focus to the browser's toolbar, not to the page, as with every native
  modal dialog.
- **Icon buttons:** edit and delete show only an icon, which is hidden from screen readers (`aria-hidden`). The button's
  `title` names the record, e.g. *Edit Muster GmbH*: it is the tooltip and the accessible name. There is deliberately no
  `aria-label` as well, so the title isn't exposed a second time as a description. The buttons are 34 × 34 px (at least
  24 × 24 px, WCAG 2.5.8).
- **Contrast** of the parts changed so far (measured in the browser): Start, **+ Add** and **Add time** 5.0:1, the
  selected customer or project 6.7:1, the hourly rate 5.5:1 (selected) and 6.9:1,
  the language buttons 6.7:1 and 10.3:1, the edit and delete icons 10.3:1 (at least 3:1 for graphics). Stop, delete and the error text are `red-700`, about 6.5:1 (calculated).

## Missing

From the UX review, not fixed yet:

- The active navigation button uses white on `blue-500` (about 3.7:1), below the 4.5:1 minimum, and the current page
  is shown only by color, without `aria-current`.
- On the Reports page, the labels are not linked to their dropdowns.

## Testing

- Component tests run automatic checks with axe (`vitest-axe`, `frontend/src/test/axe.js`). jsdom can't render colors,
  so contrast is checked by hand in a real browser.
- New UI parts are checked with the keyboard in the browser before they are committed.
