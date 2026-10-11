# Design

The look of the UI: colors, the light and dark theme, type, shared styles and the page layout. The layout and the dark
theme were drafted on a design canvas (Time tracking, Reports, Time tracking on a phone, each light and dark) and then built into
the frontend.

## Colors

Components use Tailwind color names (`bg-paper`, `text-muted`, …), never hex values. `frontend/tailwind.config.js`
maps each name to a CSS variable, and `frontend/src/index.css` sets the variables once for the light and once for the
dark theme. Opacity modifiers like `bg-paper/70` keep working, because the variables hold plain `r g b` values.

| Name | Light | Dark | Use |
| --- | --- | --- | --- |
| `paper` | `#F4F2EC` | `#161513` | page background |
| `surface` | `#FFFFFF` | `#201E1B` | cards, header, sidebar, inputs |
| `ink` | `#1D1C1A` | `#EDEAE3` | text |
| `muted` | `#5E5A52` | `#A8A296` | secondary text, labels of figures |
| `line` / `line-soft` | `#E2DED4` / `#ECE8DF` | `#34312C` / `#2C2A26` | card borders, table rows |
| `line-strong` | `#8A8477` | `#77715F` | borders of inputs and buttons |
| `accent` | `#0E5C58` | `#5DB3AB` | primary buttons, selection, links, focus ring |
| `accent-dark` | `#0A4441` | `#9AD9D2` | hover of primary buttons, text of the selected customer |
| `accent-soft` | `#E3EFEC` | `#1C3431` | background of the selected customer |
| `danger` | `#B42318` | `#F0566E` | the running timer, Stop, delete, errors |
| `danger-dark` | `#8F1C13` | `#F57A8C` | hover of Stop and delete |
| `danger-soft` / `danger-line` | `#FDECEA` / `#F3C4BF` | `#3A1A21` / `#6E3240` | running-timer bar, running entry, confirmations |
| `on-fill` | `#FFFFFF` | `#0E0D0C` | text on `accent` and `danger` fills |

Red is reserved for the running timer and for destructive actions, so a running timer stands out on every page.
In the dark theme the fills are lighter and carry dark text (`on-fill`); the `-dark` shades are the hover colors, so
they get lighter too. The dialog backdrop is plain black at 50 %, independent of the theme.

## Light and dark theme

- The header has a theme switch next to the language (*Farbschema* / *Theme*): **Hell** / *Light*, **Dunkel** /
  *Dark* and **Wie das System** / *Like the system*. Without a choice, the app follows the operating system, and
  switches along when the system does.
- Switching needs no reload. The choice is stored in the browser (`localStorage`, key `theme`), like the language.
- `theme.js` resolves the choice and sets `data-theme="light"` or `"dark"` on `<html>`; `main.jsx` does this before the
  first render, so the page doesn't flash in the wrong theme. The dark theme also sets `color-scheme: dark`, so native
  controls (selects, date and time pickers, scrollbars) are dark as well.
- Code: `frontend/src/theme.js`, `components/ThemeSwitcher.jsx`. Tests (in `frontend/tests/`): `theme.test.js`, `ThemeSwitcher.test.jsx`.
Contrast values are listed in [Accessibility](accessibility.md).

## Type

Self-hosted with `@fontsource` packages (imported in `frontend/src/main.jsx`), so the app needs no requests to font
services and works offline:

- **IBM Plex Sans** (400, 500, 600): all text (`font-sans`)
- **IBM Plex Mono** (400, 500): times, durations and amounts in tables (`font-mono`), so digits line up
- **Newsreader** (500, 600): customer name, report title and large figures (`font-serif`)

The PDF report uses IBM Plex Sans too (400 and 600), from font files in the backend, see
[Reports API](../backend/reports.md#pdf-report).

## Shared styles

`frontend/src/ui.js` holds the class strings that more than one component needs: `buttonPrimary`, `buttonSecondary`,
`buttonDanger`, `iconButton`, `input`, `label`, `card`, `eyebrow` (small uppercase section labels) and `figure` (large
numbers). New components use these instead of repeating Tailwind classes. `index.css` sets the page colors and one
focus ring (`:focus-visible`, 2 px `accent`) for every control.

## Favicon

`frontend/public/favicon.svg` is the header's clock (Heroicons `ClockIcon`, stroke 2 so it reads at 16 px) in the
accent color. An SVG file can't use the theme names, so it repeats the two accent values from `index.css`: `#0E5C58`,
and `#5DB3AB` under `prefers-color-scheme: dark`, so it stays visible on dark browser tabs. It follows the system
theme, not the app's theme switch. nginx caches `.svg` files for 30 days, so after changing the icon a browser may need
a hard reload. Test: `frontend/tests/favicon.test.js`.

## Layout

- **Header** (every page): app name, the page navigation (*Dashboard*, *Time tracking*, *Reports*), the running timer with its own
  **Stop** button, and the language switch. See [Timer](timer.md).
- **Dashboard:** track time next to four key figures, the hours chart next to hours per customer, the billing table
  next to the recent entries. See [Dashboard](dashboard.md).
- **Time tracking:** customers in a sidebar on the left; to the right the selected customer's name, the project filter,
  the timer and the month summary side by side, and the entries below. See [Time tracking](time-tracking.md).
- **Reports:** customer and month above a report card with figures, the entries table and totals. See
  [Reports](reports.md).

### Small screens

Below 1024 px (`lg`) the sidebar moves above the content and the customers wrap as buttons; below 1280 px (`xl`) the
timer and the month summary are stacked. Tables scroll sideways inside their card, so the page itself never scrolls
horizontally at 390 px width.

Not built from the phone draft: entries as cards with a "more actions" menu, and a fixed **Add time** bar at the bottom.
On phones the entries stay a table that scrolls sideways.
