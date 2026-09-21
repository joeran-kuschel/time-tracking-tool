# Error messages

When a request to the backend fails, the UI says so next to the action that failed, instead of failing silently.

## What you see

Each message names what failed and what to do, for example:

- *Kunde konnte nicht angelegt werden. Bitte versuche es erneut.* / *Customer could not be created. Please try again.*
- *… Der Server ist nicht erreichbar.* / *… The server is not reachable.* when the backend can't be reached at all
- *Timer konnte nicht gestartet werden. Es läuft bereits ein Timer.* / *Timer could not be started. A timer is already
  running.* when a timer runs elsewhere

If the customers can't be loaded when the app starts, a message with a **Try again** button (*Erneut versuchen*)
appears above the page.

Typed text stays in its field when saving fails. A failed start leaves the timer stopped; a failed stop leaves it
running, so you can try again.

## Accessibility

Messages use `role="alert"`, so screen readers announce them. The text is dark red (`red-700`, above the WCAG AA
contrast minimum).

## How it works

- `frontend/src/api.js` sends every request through one `request()` helper. It throws an `ApiError` with the HTTP
  status, or status `0` when the server can't be reached.
- The `useAction` hook runs a request and keeps the failure. It returns the result, or nothing when it failed.
- Messages are stored as untranslated descriptors (`msg`) and translated when rendering, so a visible message follows a
  language switch.
- The backend's own error texts are English and not shown; the UI uses its own message per action.

## Not covered yet

Errors from the PDF download are not shown.

## Code

`frontend/src/api.js`, `hooks/useAction.js`, `components/ErrorMessage.jsx`. Tests: `api.test.js`,
`hooks/useAction.test.js`, `App.test.jsx`.
