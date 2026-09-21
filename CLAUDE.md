# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Time tracking tool for freelancers: track working time per customer and project, generate monthly PDF reports.

## Rules

- Plan first, ask before changing code
- Don't refactor without permission
- Data has to be persistently stored somewhere
- Tool should run on a local kubernetes cluster but with the option to have a remote database
- Add test cases for everything we implement
- The UI has to be accessible and adhere to W3C and WAI standards (target: WCAG 2.2 level AA)
- Be lean in the code: avoid duplicated code and tight coupling
- Documentation is key: document every feature in Markdown files in `documentation/`, in dedicated chapters, split into UI (`documentation/ui/`) and Backend (`documentation/backend/`)
- The tool is available in German and English. Use a gettext-style translation tool; switching the language must not reload the page
- During development, only run new tests and the tests affected by the changed code, not the entire test suite (see "Single test file / test name" under Commands)

## Current decisions

- Use the in-cluster (local) Postgres for now. Keep the remote database option working, but it is not in use.
- Target cluster: Docker Desktop Kubernetes (kube context `docker-desktop`).
- User-facing docs (README.md, k8s/README.md) are written in German. Keep them in German.
- Feature documentation in `documentation/` is written in English. `docs/` is separate: local reports only, not in git.
- Translation tool: LinguiJS 5 (gettext `.po` files, language switch at runtime). English is the source language in the code; German comes from `de/messages.po`. Lingui 6 would need Vite 6+.

## Stack

- **Frontend** (`frontend/`): React, Vite, Tailwind, served by nginx in its image
- **Backend** (`backend/`): Node.js 24, Express, `pg`. Structure: `src/routes`, `src/controllers`, `src/models`, `src/config`
- **Database**: PostgreSQL 15. Schema in `backend/migrations/*.sql`
- **Deployment**: manifests in `k8s/`, Docker Compose in `docker-compose.yml` for local development

Feature details, endpoints and known gaps are documented per feature in `documentation/` (index: `documentation/README.md`).

## Architecture

- **Frontend state:** `App` owns the customer list and the running timer (`useActiveEntry`), so both survive switching between Dashboard and Reports and are reloaded from the backend after a page reload. Pages get the timer as one `timer` prop. `components/Timer.jsx` only displays and makes no API calls.
- **API calls and errors:** `api.js` sends everything through `request()`, which throws `ApiError` with the HTTP status (`0` = server unreachable). Components run calls through the `useAction` hook, which returns the result or `undefined` and keeps the error for `ErrorMessage` (`role="alert"`). Use this chain for new calls instead of your own `try/catch`.
- **Editing in place:** customer and project lists use `EditableList`; entry rows use the same `useEditable` hook (view / edit / confirm-delete state, errors, returning focus). Forms are `RecordForm` (visible labels, `validate`, Escape cancels); the entry form is `EntryForm`. The Dashboard keeps only selected ids and looks the records up, so a rename shows at once. Deleting anything that contains the running timer answers `409` in the backend.
- **Frontend translation:** texts are English Lingui macros (`<Trans>`, `t` from `useLingui()`, `msg`). Messages that are shown later, like errors, are passed as lazy `msg` descriptors and translated when rendering, so visible ones follow a language switch. `i18n.js` loads both catalogs and switches the language; `format.js` formats hours and rates for the active language.
- **Backend:** `routes → controllers → models`. Models query the shared `pg` pool from `config/database.js` directly. Business rules live in the controllers, e.g. only one running timer (`POST /api/time-entries` answers `409`).
- **Backend translation:** one shared Lingui instance, used for the PDF report. Call `activateLocale()` from `src/i18n.js` and translate synchronously right after it (see `utils/pdfGenerator.js`), so concurrent requests can't mix languages. Messages need a fixed id and `i18n` imported from `@lingui/core` (`i18n._({ id, message })`), otherwise `lingui extract` doesn't find them.

## Commands

Use Node 22+ locally; the Docker images use Node 24. There is no linter configured.

```bash
# Tests
cd backend && npm test
cd frontend && npm test

# Single test file / test name
cd backend && npx jest tests/timeEntry.model.test.js -t "keeps the description"
cd frontend && NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/App.test.jsx -t "resumes"
# Without NODE_OPTIONS, every frontend test that touches localStorage fails (see Testing)

# Frontend dev server and production build
cd frontend && npm run dev
cd frontend && npm run build

# After adding or changing texts: extract them, then fill in the German msgstr in src/locales/de/messages.po
cd frontend && npm run extract
cd backend && npm run extract

# Build images
docker build -t time-tracking-backend:latest ./backend
docker build -t time-tracking-frontend:latest ./frontend

# Load them into the cluster. Docker Desktop runs Kubernetes in kind mode, which has its own
# image store, so imagePullPolicy: Never only finds images imported into the node
for img in time-tracking-backend time-tracking-frontend; do
  docker save "${img}:latest" | docker exec -i desktop-control-plane ctr --namespace k8s.io images import -
done

# Deploy in this order
kubectl config use-context docker-desktop
for f in namespace configmap postgres-init-scripts postgres backend frontend; do kubectl apply -f k8s/$f.yaml; done

# Pick up new images
kubectl -n time-tracking rollout restart deployment/backend deployment/frontend
```

The database volume lives inside the kind node: a Docker Desktop update or cluster reset deletes it, and so does `kubectl delete namespace time-tracking`. Back up first with `k8s/backup-db.sh`; an hourly launchd job does this automatically (details, restore: `documentation/backend/database-backups.md`).

Docker Desktop publishes the LoadBalancer services on localhost: frontend at http://localhost, API at http://localhost:3000 (`/health`, `/api/...`).

## Configuration

- `k8s/configmap.yaml` holds:
  - the ConfigMap `time-tracking-config` (`NODE_ENV`, `DB_SSL`)
  - the Secret `time-tracking-db` (`DATABASE_URL`)
  - the Secret `postgres-secret` (Postgres credentials)
- `DB_SSL` (`"true"`/`"false"`) turns SSL on for the database connection, independent of `NODE_ENV`. Keep it `"false"` for the in-cluster Postgres, which has no SSL. Logic: `backend/src/config/ssl.js`.
- Credentials in the repo (`password`) are local placeholders only.

## Migrations

- After adding or changing a file in `backend/migrations/`, run `./k8s/generate-init-scripts.sh` to regenerate `k8s/postgres-init-scripts.yaml`. Never edit the generated file by hand. A test fails if the two drift apart.
- Postgres runs init scripts only on first start with an empty volume. An existing PVC needs the SQL applied by hand, or the volume deleted, which deletes all data.
- A remote database needs the schema applied by hand.

## Testing

- Backend tests live in `backend/tests/` and use Jest. Patterns: model tests run real SQL against the migrations in pg-mem (`tests/helpers/testDb.js`); controller tests mock the model and use a fake `res`; `js-yaml` checks the k8s manifests; the shell scripts in `k8s/` are tested against a fake `kubectl`/`launchctl` on the `PATH`.
- Frontend tests live next to the components (`*.test.jsx`) and use Vitest 0.34 (the last version that supports Vite 4), React Testing Library and vitest-axe. Import `axe` from `src/test/axe.js`.
- axe runs in jsdom, where color contrast can't be checked. Check contrast in a real browser.
- Frontend tests import `render`/`renderHook` from `src/test/render.jsx`, which adds the `I18nProvider`. Tests run in German by default; `src/locales/catalogs.test.js` (and `backend/tests/i18n.test.js`) fail when a text is not extracted or a German translation is missing.
- The frontend test script sets `NODE_OPTIONS=--no-experimental-webstorage`: Node 22+ has its own `localStorage` global, which hides jsdom's in Vitest 0.34.

## Known open issues

- `backend.yaml` has a `wait-for-db` init container that waits for host `postgres`. With a remote database the backend would never start.
- `npm audit` in `frontend/` reports vulnerabilities in dev tools only (Vitest 0.34, esbuild via Vite 4); the production image doesn't contain them. Fixing needs Vite 6+ and a current Vitest.
