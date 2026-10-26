# Changelog

What changed in the time tracking tool, newest first. Format: [Keep a Changelog](https://keepachangelog.com).
How to write an entry and cut a release: [documentation/backend/changelog.md](documentation/backend/changelog.md).

## [Unreleased]

### Added

- Every page has its own address (`/`, `/time-tracking`, `/entries`, `/reports`): a reload keeps the page, the browser's back and forward buttons move between pages, and you can bookmark a page or open it in a new tab (also with a middle click on the navigation). A link opened while logged out leads to the login and then to that page. An unknown address shows a *Page not found* page with a link to the Dashboard. The browser tab's title names the page, and focus moves to the new page's heading for keyboard and screen reader users. Selected customers, projects and months are not part of the address yet.
- New **Entries** page (German: *Einträge*) between *Time tracking* and *Reports*: search the descriptions of all customers and filter by customer, project and period (today, this week, last month, a custom range and more), sorted newest or oldest first, with the number of entries and hours found. It opens with the current month; *Reset filters* clears every filter. The filters can be collapsed and the active ones stay visible as chips you can remove. A result opens the customer's page in *Time tracking*.
- Reports can be downloaded as a CSV file for spreadsheets: **Download CSV** (German: *CSV herunterladen*) on the Reports page next to *Download PDF* lists the same entries of the customer and month with date, start, end, customer, project, description and hours. German files use `;` between the columns and decimal commas, English files use `,` and decimal points, so the file opens correctly in Excel in the matching language. Amounts are not included yet.
- Login: the tool asks for an email and a password and has a *Log out* button in the header. There is one user; create it (and change the password later) with `node src/scripts/set-user.js you@example.com`, which asks for the password: at least 10 characters with a capital letter, a number and a special character. You stay logged in for up to 30 days, or until you have not used the tool for 14 days. After 10 failed logins the login is blocked for up to 15 minutes. Existing installs: see "Upgrading an Existing Install to the Login" in `k8s/README.md`.
- The tool is served over HTTPS at https://time-tracking.local; http redirects to it. `k8s/setup-tls.sh` creates a certificate your browsers trust (needs `mkcert`). Existing installs run it once and restart the backend, see "Upgrading an Existing Install to HTTPS" in `k8s/README.md`.
- Tooling: every backend and frontend test run ends with a timing report: time per test file, the 10 slowest tests (`TEST_TIMINGS=all` for every test) and the time of the entire run.

### Changed

- The backend and the database can no longer be reached directly from other devices or other pods; Docker Compose publishes only the web page, and only on this machine (development ports: see the README). Anyone who can open the tool can still use it, and the login protects the data. Existing installs: see "Network Policy" in `k8s/README.md`.
- Only the tool's own backend can connect to the database in the cluster; backups are not affected. Existing installs: see "Network Policy" in `k8s/README.md`.
- Tooling: the frontend test run prints its timing report again after the Vitest 5 update.
- Tooling: changes reach `main` through pull requests; `main` is protected and needs the passing checks `backend tests` and `frontend tests`.
- Tooling: CodeQL code scanning is on for the repository.
- Tooling: `CLAUDE.md` is reordered into Things worth knowing, Commands, Layout, Styling, Kubernetes, Testing and Rules, and the rules are merged into groups with the pull request process as a numbered list.
- Tooling: new documentation chapter "Browser review": how to review a change in the browser with a throwaway database and sample data, also for branches in a git worktree. A test checks that every documentation chapter is linked from the index.
- Screen readers now read each project's and customer's share of the month's hours (e.g. "70 % of total") next to the hours in the month summary and in "By customer" on the Dashboard.
- Tooling: the repository has a Code of Conduct (Contributor Covenant 2.1).
- Tooling: fixed a test of `k8s/setup-tls.sh` that failed at random; its fake `openssl` now reads its input like the real one.
- The API answers `401` without a login for everything except `/health`. Anything else that calls it, such as scripts, has to log in first (`POST /api/auth/login`) and send the cookie.
- Tooling: Dependabot no longer proposes major updates of the Babel plugin that Jest needs in version 7.
- Tooling: test and config packages updated (Jest 30, jest-dom 7, js-yaml 5, dotenv 18).
- Tooling: dependencies updated to their latest major versions (React 19, Vite 8, Vitest 5, Tailwind CSS 4, Lingui 6, Express 5, jsdom 30).
- PDF report downloads: file names with accents or other non-ASCII letters now show a plain `?` in the basic file name; the full name stays in the extended `filename*` that browsers use. A plain ASCII file name is sent without quotes.
- Tooling: GitHub test workflow, issue and pull request templates, `CONTRIBUTING.md` and `SECURITY.md`.
- Tooling: Dependabot checks the dependencies and GitHub Actions weekly.
- The README warns that the API has no login.
- Tooling: the `test-engineer` agent reports test timings: the time of the test files it adds, their slowest tests and, for a full run, the entire-run time.
- Tooling: the frontend tests moved from next to the code into `frontend/tests/`, mirroring `src/`.
- Tooling: the project rules now ask for a changelog entry per change, a test run before every push, cleaning up test data in the real database, a marker for tests that document known bugs, and closing implemented GitHub issues.

### Fixed

- Creating a project for a customer that does not exist now answers `400` ("Customer not found") instead of a server error `500`. The same goes for a customer id that is not a number.
- With a remote database, the backend now starts: it waits for the database in `DATABASE_URL` instead of always for the in-cluster Postgres.
- The arrows of the dropdowns (project, customer and status selects, forms) now have space to the right border, in the light and the dark theme.
