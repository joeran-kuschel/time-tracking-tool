# Settings

The **Settings** page (German: *Einstellungen*, `/settings`) is the place for options that apply to the whole tool. They
are saved on the server, so they are the same in every browser. The language and the theme stay browser choices in the
header.

## Now

The page has no options yet: it shows the heading and the note *There are no options yet.* The first option, the
rounding of tracked time, comes with its own issue and adds a form here.

## Behavior

- **Navigation:** the last item of the main navigation, see [Navigation and addresses](navigation.md). Like every page it
  sets the page title (*Settings · Time Tracking*) and moves focus to its `<h1>` when it is opened from the navigation.
- **Loading and saving:** `api.getSettings()` and `api.updateSettings(options)` call the
  [Settings API](../backend/settings.md); `pages/Settings.jsx` does not use them until there is an option to show.
- **Planned for the first option:** fields with visible labels and an explicit **Save** button (no autosave: errors and
  the confirmation are easier to make accessible). A saved change is confirmed in a `role="status"` region; a failed save
  shows an `ErrorMessage` (`role="alert"`) and keeps what was typed (`useAction`, see [Error messages](error-messages.md)).
  Until something is saved, the defaults apply and the tool behaves as before.

## Tests

`tests/pages/Settings.test.jsx` (heading, note, axe), `tests/routes.test.js` (the route), `tests/api.test.js` (the two
calls) and `tests/App.test.jsx` (the navigation item in both languages).
