# Login

Without a login session, the app shows only the login page. The backend side is described in
[Authentication](../backend/authentication.md).

## What the user sees

- **Login page** (`pages/Login.jsx`): the name, an `<h1>` *Log in*, the fields *Email* and *Password* and a *Log in*
  button; the theme and language switchers are in the top right corner and work as in the app. The form is
  `RecordForm`, so labels, `required` and error handling are the same as everywhere.
- **Wrong credentials:** *Login failed. Check email and password.* as an alert; the email stays in the field. After too
  many failed logins: *Too many failed attempts. Try again in a few minutes.*; with the server down: *The server is not
  reachable.*
- **Logged in:** the app as before, with a *Log out* button in the header next to the switchers. Logging out removes
  the app, so none of its data stays in memory, and shows the login page.
- **Deep links:** a page opened while logged out (for example `/reports`) shows the login page at that address, and
  after the login the same page opens. Logging out on purpose resets the address to `/` (the Dashboard); a session
  that ends on its own keeps the address, so the next login returns to the page. The login page's title is *Log in ·
  Time Tracking*. See [Navigation and addresses](navigation.md).
- **Session ended while working** (for example after 14 idle days, or after the password was changed): the next request
  is answered with `401`, the app is replaced by the login page, and a status line says *Your session has ended.
  Please log in again.* The data on the page is gone; unsaved form input is lost.
- **Opening the page:** a *Loading...* text while the session is checked once with `GET /api/auth/me`. If the server
  can't be reached, an error with *Try again* shows instead.

## How it works

- `components/AuthGate.jsx` wraps `App` in `main.jsx`. It owns the user (`undefined` while checking, `null` logged out,
  else `{ email }`), passes `onLogout` and `logoutError` to `App`, and shows the login page otherwise.
- `api.js` sends `credentials: 'include'` with every request. A `401` on any request except the login, the logout and
  the session check calls the handler registered with `onSessionEnded`; `AuthGate` uses it to switch to the login page.
  The request still throws `ApiError`, so no component needs its own handling.
- `api.getSession()` answers `null` instead of throwing when nobody is logged in.
- A failed logout (server not reachable) keeps the user logged in and shows *Logging out failed.* with the reason: the
  session would otherwise stay valid on the server while the user believes it is gone. A `401` on logout means the
  session was already gone and counts as logged out.
- A `401` that arrives after the user logged out (a request that was still running) is ignored, so the login page shows
  no *session ended* notice then.
- The PDF preview links open a new tab; the browser sends the cookie with that navigation (`SameSite=Lax`).

## Accessibility

- Visible labels, `autocomplete="username"` and `"current-password"` so password managers fill the form, and pasting is
  allowed. No CAPTCHA, puzzle or memory test (WCAG 3.3.8 Accessible Authentication).
- Errors use `role="alert"`; the *session ended* notice uses `role="status"`. The first field takes focus when the
  page opens.
- After logging in or out the focus returns to the start of the page, like after a page load.
- axe finds no violations in German and English, also with an error and the notice.

## Tests

`tests/pages/Login.test.jsx` (fields, autocomplete, errors by status, paste, notice, language switch, axe),
`tests/components/AuthGate.test.jsx` (checking, logged in and out, retry, logout and its failure, ended session),
`tests/api.test.js` (cookie, `401` handling) and `tests/App.test.jsx` (the logout button).
