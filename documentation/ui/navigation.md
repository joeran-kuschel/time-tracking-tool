# Navigation and addresses

Every page has its own address. A reload keeps the page, the browser's back and forward buttons move between the
visited pages, and a page can be bookmarked or opened in a new tab.

## Addresses

| Address | Page |
| --- | --- |
| `/` | Dashboard |
| `/time-tracking` | Time tracking, no customer selected |
| `/time-tracking/:customerId` | Time tracking with the customer selected, e.g. `/time-tracking/3` |
| `/time-tracking/:customerId/:projectId` | the customer and one of its projects, e.g. `/time-tracking/3/7` |
| `/entries` | Entries |
| `/reports` | Reports, no customer selected |
| `/reports/:customerId` | Reports of the customer for the current month |
| `/reports/:customerId/:yearMonth` | the report of a month, e.g. `/reports/3/2026-09` |
| anything else | *Page not found* (German: *Seite nicht gefunden*) with a link to the Dashboard |

A trailing slash is the same address (`/reports/`), and the case of the letters does not matter.

## Selections in the address

The selected customer, project and month are part of the address, so a reload, a bookmark, a link sent to someone
else or "open in new tab" keeps them.

- **Choosing** a customer or a project on Time tracking, or a customer on Reports, adds a history entry: the browser's
  Back button returns to what was open before. Choosing the selected project again goes back to the customer. Clicking what is already open adds
  nothing. With a timer running for a customer, choosing that customer in the sidebar selects the timer's project too;
  a link or an address to the customer alone (`/time-tracking/3`) shows it without a project.
- **Stepping through the months** on Reports replaces the current history entry, so Back does not walk through every
  month. The arrows are marked `aria-disabled` and do nothing until a customer is chosen, because an address without a
  customer has no month; they stop at the years 1000 and 9999, the only years an address can name.
  Changing the customer keeps the month.
- **Links:** the places that open another page with a selection are real links, no buttons: the Dashboard (*Monthly
  reports*, the customer rows, *View all*, the recent entries, the customer names in the billing table, *Open report*
  in the notice about last month), *Open report* in the month summary and *Open* on the Entries page. Middle click and
  "open in new tab" work.
- **After a reload** the Time tracking page without a customer in the address opens the customer and project of the
  running timer (it replaces the address, so Back leaves the page).
- **Unknown records:** an address with a customer or project that does not exist (any more), like `/time-tracking/99`
  or `/reports/abc`, shows an alert (*This customer does not exist (any more).* / *This project does not exist (any
  more).*; German *Dieser Kunde existiert nicht (mehr).* / *Dieses Projekt existiert nicht (mehr).*) with a link out
  (*Back to Time tracking*, *Back to Reports*, *Show all projects*); following the link moves focus to the page's
  heading, because the link disappears with the message. Nothing is requested from the server for a
  customer that is not in the list. The project is only reported after the customer's projects have loaded, and a
  project of another customer counts as unknown. A project or customer that the user deletes on the page is replaced
  in the address (`replace`) by its parent, without a message.
- **Months that are none** (`/reports/3/foo`, `/reports/3/2026-13`) and addresses with more segments than the table
  has are *Page not found*.
- **Not in the address:** the Entries filters (see [Entries](entries.md)) and anything typed in a form.

No page address may start with `/api` or `/health`: the frontend's nginx sends those to the backend. A test over the
route table checks this.

## How it works

- **Router:** React Router (`react-router` 8, declarative mode). `main.jsx` wraps `AuthGate` in `<BrowserRouter>`, so
  the login page and the app share one router and a deep link survives the login (see [Login](login.md)).
- **Route table:** `src/routes.js` lists the pages (`id`, `path` for the navigation link, `pattern` with the optional
  `:customerId`, `:projectId` and `:yearMonth` segments, translated `label`) once, and builds the addresses with
  selections (`trackingPath`, `reportPath`) and reads them (`idFromParam`, `periodFromParam`). `App` renders the main
  navigation and the `<Routes>` from it; the `*` route is `pages/NotFound.jsx`. `App` stays mounted while the page
  changes, so the customer list and the timer (the header's *Running timer* region and its status announcement lie
  outside the routes) are loaded once.
- **Main navigation:** the items in `<nav aria-label="Main">` are real links (`<a href>`, React Router's `Link`): middle
  click and "open in new tab" work. The current page has `aria-current="page"` and the underline, on every address of
  the page including its selections (`pageFor` in `routes.js` matches the page's pattern; a trailing slash counts). On `/reports/1/2026-09` the
  *Reports* link is current; on an address that is *Page not found*, such as `/reports/1/foo`, no link is. `NavLink`
  with `end` is not used because it does not match `/reports/`.
- **Server:** the frontend's nginx answers unknown paths with `index.html` (`try_files`), so a reload on any address
  works behind the Ingress and in Docker Compose; `/api/` and `/health` go to the backend first. `index.html` carries
  `Cache-Control: no-cache` (the fallback and `error_page 404` end up in that location too), so a reload after a
  deploy loads the new build; the files under `/assets/` have a hash in their name and stay cached for 30 days.
  The Vite dev server falls back to `index.html` as well.

## Page title and focus

- **Title:** `usePageTitle` sets `document.title` to *\<Page\> · Time Tracking*, e.g. *Reports · Time Tracking* or
  *Berichte · Time Tracking*. It follows a language switch. The login page (*Log in*) and the not-found page have their
  own titles.
- **Focus:** when the first part of the address changes through a click, back or forward, `useFocusOnPageChange` moves
  focus to the new page's `<h1>` (the hook gives it `tabIndex="-1"`), or to `<main>` when a page has none. Reports and
  Time tracking without a customer have a visually hidden `<h1>`. Focus does not move on the first load, after a login
  (focus goes to `<main>` there, see [Accessibility](accessibility.md)), or when the same page stays open. The timer's
  status region is not involved.
