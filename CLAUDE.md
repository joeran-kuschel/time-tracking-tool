# Time Tracking Tool

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Time tracking tool for freelancers: track working time per customer and project, generate monthly PDF reports. It stores its data persistently, runs on a local Kubernetes cluster with the option of a remote database, and is available in German and English.

- **Frontend** (`frontend/`): React, Vite, Tailwind, served by nginx in its image
- **Backend** (`backend/`): Node.js 24, Express, `pg`. Structure: `src/routes`, `src/controllers`, `src/models`, `src/config`
- **Database**: PostgreSQL 15. Schema in `backend/migrations/*.sql`
- **Deployment**: manifests in `k8s/`, Docker Compose in `docker-compose.yml` for local development

Feature details, endpoints and known gaps are documented per feature in `documentation/` (index: `documentation/README.md`).

## Things worth knowing

- Use the in-cluster (local) Postgres for now. Keep the remote database option working, but it is not in use.
- Target cluster: Docker Desktop Kubernetes (kube context `docker-desktop`).
- Everything is written in English: README.md, k8s/README.md, `documentation/`, code comments and the changelog. The repo is meant to be public.
- Feature documentation lives in `documentation/`. `docs/` is separate: local reports only, not in git.
- Translation tool: LinguiJS 6 (gettext `.po` files, language switch at runtime without a reload). English is the source language in the code; German comes from `de/messages.po`. Lingui 6 is ESM-only: the frontend uses its native macro transform (`lingui({ macroTransform: true })` in `vite.config.js`), the CommonJS backend loads it with `require()` (Node 22+) and Jest transforms it (`transformIgnorePatterns` in `backend/package.json`).
- **Authentication:** one user, server-side sessions (details: `documentation/backend/authentication.md`, `documentation/ui/login.md`). `requireAuth` guards every `/api` route except `/api/auth/login` and `/health`; the cookie `session` holds a random token whose SHA-256 hash is stored in `sessions`. Passwords are `scrypt` hashes (`utils/password.js`); the user is created or changed with `node src/scripts/set-user.js <email>` (asks for the password, rule: 10 characters with a capital letter, a number and a special character). In the frontend, `components/AuthGate.jsx` wraps `App` in `main.jsx` and shows `pages/Login.jsx` until logged in. `api.js` sends `credentials: 'include'`; a `401` calls the handler from `onSessionEnded` and the gate shows the login page, so components never handle it. The cookie is `Secure` when `NODE_ENV=production`. Backend tests that call `createApp` must mock `models/Session` (see `tests/app.test.js`).
- The backend runs in UTC (`process.env.TZ` in `server.js`): times are stored as UTC and `pg` reads `TIMESTAMP` as local time. Month limits for reports follow the browser's time zone (`tz` query parameter, `monthRange` in `utils/period.js`).
- Credentials in the repo (`password`) are local placeholders only.
- `npm audit` in `frontend/` reports vulnerabilities in dev tools only (`braces` via `@lingui/cli`); `npm audit --omit=dev` finds none in either package. `backend/` lists more dev-tool findings (Jest and its dependencies).

## Commands

Use Node 22.22.2+ locally; the Docker images use Node 24. There is no linter configured. Commands for images and the cluster are under Kubernetes.

```bash
# Tests
cd backend && npm test
cd frontend && npm test

# Single test file / test name
cd backend && npx jest tests/timeEntry.model.test.js -t "keeps the description"
cd frontend && NODE_OPTIONS=--no-experimental-webstorage npx vitest run tests/App.test.jsx -t "resumes"
# Without NODE_OPTIONS, every frontend test that touches localStorage fails (see Testing)

# Frontend dev server and production build
cd frontend && npm run dev
cd frontend && npm run build

# After adding or changing texts: extract them, then fill in the German msgstr in src/locales/de/messages.po
cd frontend && npm run extract
cd backend && npm run extract
```

## Layout

- **Pages and addresses:** React Router (declarative mode); `main.jsx` wraps `AuthGate` in `<BrowserRouter>`. `src/routes.js` is the route table (`/`, `/time-tracking`, `/entries`, `/reports`; anything else is `pages/NotFound.jsx`; no path may start with `/api` or `/health`), and `App` renders the navigation (links) and the `<Routes>` from it. The selected customer, project and month are in the address (`/time-tracking/:customerId/:projectId`, `/reports/:customerId/:yearMonth`): the pages read them with `useParams`, choosing one calls `navigate`, and other pages open a selection with a `Link` to `trackingPath(...)`/`reportPath(...)` from `routes.js`. An address for a record that doesn't exist shows `MissingRecord`. `usePageTitle` and `useFocusOnPageChange` set the title and move focus on a page change (`documentation/ui/navigation.md`). Component tests that contain links use `renderWithRouter` from `tests/support/render.jsx`.
- **Frontend state:** `App` owns the customer list and the running timer (`useActiveEntry`), so both survive switching between Dashboard, Time tracking and Reports and are reloaded from the backend after a page reload. Pages get the timer as one `timer` prop. `components/Timer.jsx` only displays and makes no API calls.
- **Dashboard (start page):** `pages/Dashboard.jsx` loads everything with one request (`GET /api/dashboard`) and sums it up in the client (`dashboard.js`, reusing `summary.js`); its cards live in `components/dashboard/`. It opens other pages with links (`trackingPath`, `reportPath`). Tabs use `components/Tabs.jsx` (WAI-ARIA pattern). Report status (draft/ready/sent) is stored per customer and month in `report_status`.
- **Entries page:** `pages/Entries.jsx` searches the entries of all customers on the server (`GET /api/time-entries/search`, parsed by `utils/entryFilter.js`); its filter state lives in the page (`filters.js`, `components/EntryFilters.jsx`, collapsible), results in `components/EntryResults.jsx`, and a result links to Time tracking (`trackingPath`).
- **API calls and errors:** `api.js` sends everything through `request()`, which throws `ApiError` with the HTTP status (`0` = server unreachable). Components run calls through the `useAction` hook, which returns the result or `undefined` and keeps the error for `ErrorMessage` (`role="alert"`). Use this chain for new calls instead of your own `try/catch`.
- **Editing in place:** the selected customer and project use `EditableRecord` (edit and delete next to the Time tracking heading and the project filter); entry rows use the same `useEditable` hook (view / edit / confirm-delete state, errors, returning focus). Forms are `RecordForm` (visible labels, `validate`, Escape cancels); the entry form is `EntryForm`. Adding customers, projects and entries happens in `Modal` (native `<dialog>` with `showModal()`); it focuses the first field itself, so forms inside must not use `autoFocus`, and it must not be rendered inside a Tailwind `space-y-*` container, whose margins pull it off center. jsdom lacks `showModal()`, so `frontend/tests/support/setup.js` stubs it; check modal behavior in a browser. The Time tracking page (`pages/TimeTracking.jsx`) keeps only selected ids and looks the records up, so a rename shows at once. It loads all entries of the selected customer once (`GET /api/time-entries/customer/:id`); a selected project only filters them in the client, and `EntriesList` groups them by project. Deleting anything that contains the running timer answers `409` in the backend.
- **Frontend translation:** texts are English Lingui macros (`<Trans>`, `t` from `useLingui()`, `msg`). Messages that are shown later, like errors, are passed as lazy `msg` descriptors and translated when rendering, so visible ones follow a language switch. `i18n.js` loads both catalogs and switches the language; `format.js` formats hours and rates for the active language.
- **Backend:** `routes → controllers → models`. Models query the shared `pg` pool from `config/database.js` directly. Business rules live in the controllers, e.g. only one running timer (`POST /api/time-entries` answers `409`).
- **Backend translation:** one shared Lingui instance, used for the PDF report. Call `activateLocale()` from `src/i18n.js` and translate synchronously right after it (see `utils/pdfGenerator.js`), so concurrent requests can't mix languages. Messages need a fixed id and `i18n` imported from `@lingui/core` (`i18n._({ id, message })`), otherwise `lingui extract` doesn't find them.

## Styling

- Colors and fonts are Tailwind theme names (`tailwind.config.js`: `paper`, `ink`, `muted`, `accent`, `danger`, `on-fill`, …), never hex values in components.
- The names point to CSS variables in `index.css`, set for a light and a dark theme (`data-theme` on `<html>`, `theme.js`). Use `text-on-fill`, not `text-white`, on `accent`/`danger` fills.
- Class strings that repeat live in `src/ui.js`.
- Fonts are self-hosted via `@fontsource` (see `documentation/ui/design.md`).

## Kubernetes

```bash
# Build images
docker build -t time-tracking-backend:latest ./backend
docker build -t time-tracking-frontend:latest ./frontend

# Load them into the cluster. Docker Desktop runs Kubernetes in kind mode, which has its own
# image store, so imagePullPolicy: Never only finds images imported into the node
for img in time-tracking-backend time-tracking-frontend; do
  docker save "${img}:latest" | docker exec -i desktop-control-plane ctr --namespace k8s.io images import -
done

# Once per cluster: the ingress controller that serves https://time-tracking.local
# (/etc/hosts needs "127.0.0.1 time-tracking.local" and "::1 time-tracking.local", see k8s/README.md)
helm --kube-context docker-desktop upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx --version 4.15.1 \
  --namespace ingress-nginx --create-namespace

# Deploy in this order
kubectl config use-context docker-desktop
# setup-tls.sh (needs mkcert) creates the certificate Secret the ingress uses; it must run after the namespace and before the ingress
kubectl apply -f k8s/namespace.yaml && ./k8s/setup-tls.sh
for f in configmap postgres-init-scripts postgres backend frontend ingress network-policy-postgres network-policy-backend; do kubectl apply -f k8s/$f.yaml; done

# Pick up new images
kubectl -n time-tracking rollout restart deployment/backend deployment/frontend
```

The database volume lives inside the kind node: a Docker Desktop update or cluster reset deletes it, and so does `kubectl delete namespace time-tracking`. Back up first with `k8s/backup-db.sh`; an hourly launchd job does this automatically (details, restore: `documentation/backend/database-backups.md`).

The tool is served at https://time-tracking.local through the Ingress (`k8s/ingress.yaml`; plain http redirects to https, the certificate comes from mkcert via `k8s/setup-tls.sh`): everything goes to the frontend, whose nginx proxies `/api/` and `/health` to the backend (`frontend/nginx.conf`). Frontend and backend are ClusterIP services without a host port, so other apps in the cluster can have their own host. Two NetworkPolicies (`k8s/network-policy-*.yaml`) let only the frontend pods reach the backend and only the backend pods reach Postgres; `kubectl exec` is not affected. This is not access control: anyone who can open the app can call `/api` through it (details: `documentation/backend/deployment.md`). Docker Desktop publishes the ingress controller's LoadBalancer on ports 80 and 443 of all network interfaces, not only localhost: the API needs a login (see Authentication under Things worth knowing), but other devices on the network can reach the login page. The macOS firewall is off by default; turned on with "Block all incoming connections", it should keep them out, but that is untested.

### Configuration

- `k8s/configmap.yaml` holds:
  - the ConfigMap `time-tracking-config` (`NODE_ENV`, `DB_SSL`, `CORS_ORIGIN`)
  - the Secret `time-tracking-db` (`DATABASE_URL`)
  - the Secret `postgres-secret` (Postgres credentials)
- `DB_SSL` (`"true"`/`"false"`) turns SSL on for the database connection, independent of `NODE_ENV`. Keep it `"false"` for the in-cluster Postgres, which has no SSL. Logic: `backend/src/config/ssl.js`.
- `CORS_ORIGIN` depends on the install: the comma-separated addresses the frontend is opened at. Only these may call the API from a browser; without it, none can. Set it together with the host in `k8s/ingress.yaml`.
- `VITE_API_URL` is a build argument of the frontend image, not a ConfigMap value. The Dockerfile default `/api` is the frontend's own host, so it needs no change when the host changes. Docker Compose uses the default too (nginx proxies it); it publishes only the frontend on `127.0.0.1:80`, and `docker-compose.dev.yml` adds the database and backend ports for development. The API setup is in `backend/src/app.js`; `server.js` only starts it.

### Migrations

- After adding or changing a file in `backend/migrations/`, run `./k8s/generate-init-scripts.sh` to regenerate `k8s/postgres-init-scripts.yaml`. Never edit the generated file by hand. A test fails if the two drift apart.
- Postgres runs init scripts only on first start with an empty volume. An existing PVC needs the SQL applied by hand, or the volume deleted, which deletes all data.
- A remote database needs the schema applied by hand.

## Testing

- Backend tests live in `backend/tests/` and use Jest. Patterns: model tests run real SQL against the migrations in pg-mem (`tests/helpers/testDb.js`); controller tests mock the model and use a fake `res`; `js-yaml` checks the k8s manifests; the shell scripts in `k8s/` are tested against a fake `kubectl`/`launchctl` on the `PATH`.
- Frontend tests live in `frontend/tests/`, mirroring `src/` (`tests/components/Foo.test.jsx` tests `src/components/Foo.jsx`; source is imported via the `@/` alias) and use Vitest, React Testing Library and vitest-axe. Import `axe` from `tests/support/axe.js`.
- axe runs in jsdom, where color contrast can't be checked. Check contrast in a real browser.
- Frontend tests import `render`/`renderHook` from `tests/support/render.jsx`, which adds the `I18nProvider`. Tests run in German by default; `frontend/tests/locales/catalogs.test.js` (and `backend/tests/i18n.test.js`) fail when a text is not extracted or a German translation is missing.
- Both test runs end with a timing report (per file, slowest tests, entire run; `TEST_TIMINGS=all` lists every test): `documentation/backend/test-timing.md`.
- The frontend test script sets `NODE_OPTIONS=--no-experimental-webstorage`: Node 22+ has its own `localStorage` global, which hid jsdom's in older Vitest versions.

## Rules

### Working style

- Plan first and ask before changing code. Don't refactor without permission. Don't commit or push without being asked
- Data is stored persistently. The tool runs on a local Kubernetes cluster with the option of a remote database. It is available in German and English with a gettext-style translation tool, and switching the language never reloads the page
- Be lean in the code: avoid duplicated code and tight coupling
- Add test cases for everything we implement
- The UI has to be accessible and adhere to W3C and WAI standards (target: WCAG 2.2 level AA)
- Document every feature in Markdown files in `documentation/`, in dedicated chapters, split into UI (`documentation/ui/`) and Backend (`documentation/backend/`)
- Every feature, fix or removal adds an entry to `Unreleased` in `CHANGELOG.md` in the same branch, written for the app's user; the `code-reviewer` checks it (`documentation/backend/changelog.md`)

### Tests and data

- During development, only run new tests and the tests affected by the changed code, not the entire test suite (see "Single test file / test name" under Commands)
- Before every push of a branch, run the entire test suite (backend and frontend); push only when it passes. The final run of the pull request process counts for the first push; a fix pushed later, for example after a red check on GitHub, needs the entire suite again first
- Tests and sample data never stay in the real database (the cluster's). Tests use pg-mem; if a browser review, a manual check or a seed put customers, projects, entries or other rows into the real database, remove them right after, before reporting it as done. Look at what you delete first (name, creation time) and never touch the user's own data
- A test that documents a known bug (one the user decided to fix later) is marked `test.failing` (Jest) / `it.fails` (Vitest) with a `// BUG:` comment until the bug is fixed

### Branches and pull requests

Every code change (fix, new feature, refactoring) goes into its own branch and reaches `main` through a pull request; docs and rules changes too. `main` is protected by the ruleset "Protect main" (pull request required, checks `backend tests` and `frontend tests` must pass, no force push, no deletion; `documentation/backend/repository.md`). Never push to `main` directly, not even though the admin bypass would allow it.

Every new feature is shown in the browser first: check out the branch, start the dev server (`frontend-dev` in `.claude/launch.json`) with `preview_start`, and let the user look at it (setup with a throwaway database: `documentation/backend/browser-review.md`). Change requests from that review are done on the branch first; the pull request process starts only after the user approves.

The pull request process:

1. Run the `test-engineer` agent (`.claude/agents/test-engineer.md`) on everything the pull request brings in. It writes the missing tests and reports coverage gaps and bugs. Fix every bug it finds on the branch before step 2; a known bug never goes into a pull request. Also use it after implementing a feature or fix outside this process.
2. Run the `code-reviewer` agent (`.claude/agents/code-reviewer.md`) one time, on everything the pull request brings in, including the tests the `test-engineer` added and the bug fixes. Fix its findings or discuss them.
3. Run `npm run extract` in `frontend/` and `backend/` and commit the catalogs, so the final test run sees the tree that goes into the pull request.
4. Run the entire test suite (backend and frontend) as the last step. If it fails, fix the cause and run it again. Neither agent runs again on fixes of its findings or of a failed run.
5. When the user asks for the pull request (pushing needs their word), push the branch and open it with `gh pr create`: fill in `.github/pull_request_template.md`, end the description with the attribution line, and name the GitHub issue it implements with `Closes #<number>`, so GitHub closes it on merge.
6. Wait until `backend tests` and `frontend tests` are green on GitHub; a red check is fixed on the branch with a new commit.
7. Merge it (`gh pr merge --merge`, so history keeps its merge commits; the ruleset would allow squash and rebase too) only when the user says so, which also holds for Dependabot pull requests. Never enable auto-merge unless asked.
8. GitHub deletes the branch. Update the local `main` (`git checkout main && git pull`) and delete the local branch. If the pull request closed an issue, check that it is closed and comment with the merge commit, e.g. `gh issue comment <number> --body "Implemented in https://github.com/joeran-kuschel/time-tracking-tool/commit/<sha>"`.

Dependabot pull requests follow the same steps: fetch the branch and fix it first when its checks fail.
