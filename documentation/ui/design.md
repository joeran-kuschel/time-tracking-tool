# Design

The look of the UI: colors, type, shared styles and the page layout. The layout was drafted on a design canvas
(Dashboard, Reports, Dashboard on a phone) and then built into the frontend.

## Colors

Defined once as Tailwind colors in `frontend/tailwind.config.js`; components use the names, never hex values.

| Name | Value | Use |
| --- | --- | --- |
| `paper` | `#F4F2EC` | page background |
| `surface` | `#FFFFFF` | cards, header, sidebar, inputs |
| `ink` | `#1D1C1A` | text |
| `muted` | `#5E5A52` | secondary text, labels of figures |
| `line` / `line-soft` | `#E2DED4` / `#ECE8DF` | card borders, table rows |
| `line-strong` | `#8A8477` | borders of inputs and buttons (3.7:1 on white) |
| `accent` / `accent-dark` / `accent-soft` | `#0E5C58` / `#0A4441` / `#E3EFEC` | primary buttons, selection, links, focus ring |
| `danger` / `danger-dark` / `danger-soft` / `danger-line` | `#B42318` / `#8F1C13` / `#FDECEA` / `#F3C4BF` | the running timer, Stop, delete, errors |

Red is reserved for the running timer and for destructive actions, so a running timer stands out on every page.
Contrast values are listed in [Accessibility](accessibility.md).

## Type

Self-hosted with `@fontsource` packages (imported in `frontend/src/main.jsx`), so the app needs no requests to font
services and works offline:

- **IBM Plex Sans** (400, 500, 600): all text (`font-sans`)
- **IBM Plex Mono** (400, 500): times, durations and amounts in tables (`font-mono`), so digits line up
- **Newsreader** (500, 600): customer name, report title and large figures (`font-serif`)

## Shared styles

`frontend/src/ui.js` holds the class strings that more than one component needs: `buttonPrimary`, `buttonSecondary`,
`buttonDanger`, `iconButton`, `input`, `label`, `card`, `eyebrow` (small uppercase section labels) and `figure` (large
numbers). New components use these instead of repeating Tailwind classes. `index.css` sets the page colors and one
focus ring (`:focus-visible`, 2 px `accent`) for every control.

## Layout

- **Header** (every page): app name, the page navigation (*Dashboard*, *Reports*), the running timer with its own
  **Stop** button, and the language switch. See [Timer](timer.md).
- **Dashboard:** customers in a sidebar on the left; to the right the selected customer's name, the project filter,
  the timer and the month summary side by side, and the entries below. See [Dashboard](dashboard.md).
- **Reports:** customer and month above a report card with figures, the entries table and totals. See
  [Reports](reports.md).

### Small screens

Below 1024 px (`lg`) the sidebar moves above the content and the customers wrap as buttons; below 1280 px (`xl`) the
timer and the month summary are stacked. Tables scroll sideways inside their card, so the page itself never scrolls
horizontally at 390 px width.

Not built from the phone draft: entries as cards with a "more actions" menu, and a fixed **Add time** bar at the bottom.
On phones the entries stay a table that scrolls sideways.
