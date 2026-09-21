# CLAUDE.md

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

## Commands

Node: npm 12 needs Node 22.22+, 24.15+ or 26+. The nvm default is 26.9.0.

```bash
# Backend tests (Jest)
cd backend && npm install && npm test

# Frontend dev server
cd frontend && npm run dev

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

# Database backups (hourly launchd job to ~/TimeTrackingBackups; see documentation/backend/database-backups.md)
k8s/install-backup-job.sh
k8s/backup-db.sh
k8s/restore-db.sh <backup.sql.gz>
```

The database volume lives inside the kind node: a Docker Desktop update or cluster reset deletes it, and so does `kubectl delete namespace time-tracking`. Back up before either.

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

- Backend tests live in `backend/tests/` and use Jest. `js-yaml` checks the k8s manifests. Database tests use `tests/helpers/testDb.js`, which runs the real migrations in pg-mem (in-memory Postgres).
- Frontend tests live next to the components (`*.test.jsx`) and use Vitest 0.34 (the last version that supports Vite 4), React Testing Library and vitest-axe. Import `axe` from `src/test/axe.js`.
- axe runs in jsdom, where color contrast can't be checked. Check contrast in a real browser.
- Frontend tests import `render`/`renderHook` from `src/test/render.jsx`, which adds the `I18nProvider`. Tests run in German by default; `src/locales/catalogs.test.js` (and `backend/tests/i18n.test.js`) fail when a text is not extracted or a German translation is missing.
- The frontend test script sets `NODE_OPTIONS=--no-experimental-webstorage`: Node 22+ has its own `localStorage` global, which hides jsdom's in Vitest 0.34.

## Known open issues

- `backend.yaml` has a `wait-for-db` init container that waits for host `postgres`. With a remote database the backend would never start.
- `backend/src/server.js` logs the full `DATABASE_URL`, including the password, at startup.
- `npm audit` in `frontend/` reports vulnerabilities in dev tools only (Vitest 0.34, esbuild via Vite 4); the production image doesn't contain them. Fixing needs Vite 6+ and a current Vitest.
