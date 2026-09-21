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

## Current decisions

- Use the in-cluster (local) Postgres for now. Keep the remote database option working, but it is not in use.
- Target cluster: Docker Desktop Kubernetes (kube context `docker-desktop`).
- User-facing docs (README.md, k8s/README.md) are written in German. Keep them in German.

## Stack

- **Frontend** (`frontend/`): React, Vite, Tailwind, served by nginx in its image
- **Backend** (`backend/`): Node.js, Express, `pg`. Structure: `src/routes`, `src/controllers`, `src/models`, `src/config`
- **Database**: PostgreSQL 15. Schema in `backend/migrations/*.sql`
- **Deployment**: manifests in `k8s/`, Docker Compose in `docker-compose.yml` for local development

## Commands

Node: npm 12 needs Node 22.22+, 24.15+ or 26+. The nvm default is 26.9.0.

```bash
# Backend tests (Jest)
cd backend && npm install && npm test

# Frontend dev server
cd frontend && npm run dev

# Build images (Docker Desktop Kubernetes uses local images, imagePullPolicy: Never)
docker build -t time-tracking-backend:latest ./backend
docker build -t time-tracking-frontend:latest ./frontend

# Deploy in this order
kubectl config use-context docker-desktop
for f in namespace configmap postgres-init-scripts postgres backend frontend; do kubectl apply -f k8s/$f.yaml; done

# Pick up new images
kubectl -n time-tracking rollout restart deployment/backend deployment/frontend
```

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

- Backend tests live in `backend/tests/` and use Jest. `js-yaml` is used to check the k8s manifests.
- The frontend has no test setup yet. Vitest with React Testing Library is the planned choice.

## Known open issues

- `backend.yaml` has a `wait-for-db` init container that waits for host `postgres`. With a remote database the backend would never start.
- `backend/src/server.js` logs the full `DATABASE_URL`, including the password, at startup.
- The backend Dockerfile uses `node:18-alpine`, which has reached end of life.
