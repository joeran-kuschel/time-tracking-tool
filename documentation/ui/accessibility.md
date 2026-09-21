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
- **Labels:** the timer's description field has a visible label.
- **Contrast** of the parts changed so far: Start 5.0:1 and the language buttons 6.7:1 and 10.3:1 (measured in the
  browser); Stop and the error text about 6.5:1 (`red-700` on white, calculated).

## Missing

From the UX review, not fixed yet:

- White text on `green-500` (**+ Add**, *Hinzufügen*, about 2.3:1) and on `blue-500` (active navigation button,
  selected customer and project, about 3.7:1) is below the 4.5:1 minimum.
- The selected customer, project and page are shown only by color, without `aria-pressed` or `aria-current`.
- The Dashboard's input fields have only placeholders, which disappear when typing (WCAG 3.3.2).
- On the Reports page, the labels are not linked to their dropdowns.
- The hourly rate under each project uses small, semi-transparent text on blue.

## Testing

- Component tests run automatic checks with axe (`vitest-axe`, `frontend/src/test/axe.js`). jsdom can't render colors,
  so contrast is checked by hand in a real browser.
- New UI parts are checked with the keyboard in the browser before they are committed.
