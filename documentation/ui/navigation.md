# Navigation and addresses

Every page has its own address. A reload keeps the page, the browser's back and forward buttons move between the
visited pages, and a page can be bookmarked or opened in a new tab.

## Addresses

| Address | Page |
| --- | --- |
| `/` | Dashboard |
| `/time-tracking` | Time tracking |
| `/entries` | Entries |
| `/reports` | Reports |
| anything else | *Page not found* (German: *Seite nicht gefunden*) with a link to the Dashboard |

A trailing slash is the same address (`/reports/`), and the case of the letters does not matter.

**Not in the address yet:** the selected customer, project and month. After a reload, the Time tracking page selects
the customer and project of the running timer (or none), and the Reports page starts with its defaults. Putting the
selections into the address (`/time-tracking/:customerId/:projectId`, `/reports/:customerId/:yearMonth`) is the next
step of [issue #54](https://github.com/joeran-kuschel/time-tracking-tool/issues/54). Until then `App` still hands the
selection to a page when another page opens it (`openTimeTracking`, `openReport`); they now also change the address.

No page address may start with `/api` or `/health`: the frontend's nginx sends those to the backend. A test over the
route table checks this.

## How it works

- **Router:** React Router (`react-router` 8, declarative mode). `main.jsx` wraps `AuthGate` in `<BrowserRouter>`, so
  the login page and the app share one router and a deep link survives the login (see [Login](login.md)).
- **Route table:** `src/routes.js` lists the pages (`id`, `path`, translated `label`) once. `App` renders the main
  navigation and the `<Routes>` from it; the `*` route is `pages/NotFound.jsx`. `App` stays mounted while the page
  changes, so the customer list and the timer (the header's *Running timer* region and its status announcement lie
  outside the routes) are loaded once.
- **Main navigation:** the items in `<nav aria-label="Main">` are real links (`<a href>`, React Router's `Link`): middle
  click and "open in new tab" work. The current page has `aria-current="page"` and the underline, only on an exact
  match of the address (`pageFor` in `routes.js`; a trailing slash counts). So on `/reports/1/2026-09`, which is *Page
  not found* for now, no link is current. `NavLink` with `end` is not used because it does not match `/reports/`.
  **Step 2:** once selections are in the address, the parent link must stay current for nested addresses, so this
  exact-match rule is revisited then.
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
