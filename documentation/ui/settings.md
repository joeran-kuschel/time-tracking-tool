# Settings

The **Settings** page (German: *Einstellungen*, `/settings`) is the place for options that apply to the whole tool. They
are saved on the server, so they are the same in every browser. The language and the theme stay browser choices in the
header.

## Options

| Group | Option | Default | Effect |
|---|---|---|---|
| **Time and billing** (*Zeit und Abrechnung*) | **Show hourly rate and amounts in reports** (*Stundensatz und Beträge in Berichten anzeigen*) | off | The checkbox on the [Reports page](reports.md) starts from it; ticking it there changes only that visit. |

Planned: rounding, a default rate and your details, each with its own issue. With no group at all the page says
*There are no options yet.*

## Groups and saving

- **Groups:** `src/settingsGroups.js` is the list of groups (`id`, translated `label`, `options`) in the order they are
  shown, and the page is built from it. A group is a `fieldset` with a `legend`, one below the other on the same page. A
  group with no options is not shown. The file explains the shape of an option.
- **Fields:** `components/SettingField.jsx` renders an option with a visible label and an optional hint under it, which the
  field is described by (`aria-describedby`). The types are `checkbox` and `select`; a new type (for example a number
  field) is added there together with the first option that needs it.
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

`tests/pages/Settings.test.jsx` (groups, hint, one save with several changes, only the changes are sent, nothing changed,
failed save and load, language switch, axe in German and English), `tests/hooks/useSettings.test.js`, `tests/routes.test.js`,
`tests/api.test.js` and `tests/App.test.jsx` (the navigation item, the settings are loaded once).
