# Time Tracking Tool

A React-based time tracking tool for freelancers. It tracks working time per customer and project and generates monthly PDF reports.

## Features (MVP)

- Manage customers and projects
- Start and stop a timer
- Track working time per project
- Monthly billing report (PDF)
- German and English, switching the language without a page reload
- Runs locally on Kubernetes
- Remote database support
- Hourly database backups

Detailed documentation of all features: [`documentation/`](documentation/README.md)

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Containers**: Docker
- **Orchestration**: Kubernetes (Docker Desktop)

## Quick Start (Local)

### 1. Clone the repository and set up

```bash
git clone <repo-url>
cd time-tracking-tool
cp .env.example .env
```

### 2. Start with Docker Compose

```bash
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Backend (port 3000)
- Frontend (port 5173, or port 80 through nginx)

### 3. Open the browser

```
http://localhost
```

## Kubernetes Deployment (Local)

### 1. Select the cluster

```bash
kubectl config use-context docker-desktop
```

### 2. Build the images and load them into the cluster

```bash
docker build -t time-tracking-backend:latest ./backend
docker build -t time-tracking-frontend:latest ./frontend
```

Docker Desktop runs Kubernetes in kind mode, which has its own image store. Because of `imagePullPolicy: Never`, the images have to be imported into the cluster node:

```bash
for img in time-tracking-backend time-tracking-frontend; do
  docker save "${img}:latest" | docker exec -i desktop-control-plane ctr --namespace k8s.io images import -
done
```

### 3. Create the Kubernetes resources

```bash
kubectl apply -f k8s/namespace.yaml
./k8s/setup-tls.sh
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres-init-scripts.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml
```

Once per cluster, install the ingress controller first and add `time-tracking.local` to `/etc/hosts`, see `k8s/README.md`. `setup-tls.sh` needs `mkcert` (`brew install mkcert`) and creates the certificate for HTTPS.

After building new images:

```bash
kubectl -n time-tracking rollout restart deployment/backend deployment/frontend
```

**Warning:** Docker Desktop opens ports 80 and 443 on all network interfaces. Anyone on the same network can reach the login page; the API answers `401` without a login. Details and firewall: `k8s/README.md`.

Create the user once (asks for the password on the terminal), then log in at the address below:

```bash
kubectl -n time-tracking exec -it deploy/backend -- node src/scripts/set-user.js you@example.com
```

### 4. Open the browser

https://time-tracking.local

## Remote Database

For production, use a remote PostgreSQL:

```bash
DATABASE_URL=postgresql://user:pass@db.example.com:5432/time_tracking docker-compose up
```

Or in Kubernetes: update the Secret `time-tracking-db` and set `DB_SSL` in the ConfigMap (`k8s/configmap.yaml`):

```yaml
stringData:
  DATABASE_URL: "postgresql://user:pass@db.example.com:5432/time_tracking"
```

```yaml
data:
  DB_SSL: "true"
```

## Database Schema

- `customers`: customer management
- `projects`: customer projects
- `time_entries`: time entries

## API Endpoints

- `GET /api/customers` - all customers
- `POST /api/customers` - create a customer
- `GET /api/projects/customer/:customerId` - projects of a customer
- `POST /api/projects` - create a project
- `GET /api/time-entries/active` - running timer
- `POST /api/time-entries` - start a time entry
- `PATCH /api/time-entries/:id` - stop a time entry
- `GET /api/time-entries/project/:projectId` - entries of a project
- `GET /api/reports/customer/:customerId?month=9&year=2026` - monthly report (JSON)
- `GET /api/reports/customer/:customerId/pdf?month=9&year=2026&lang=de` - monthly report as PDF

All endpoints in detail: `documentation/backend/`

## Security

The API needs a login (one user, a session cookie, served over HTTPS in the cluster). The tool is still meant for one
person on a local machine: do not expose it to the internet, and replace the placeholder credentials (`password`) for
any other setup. Details and how to report a vulnerability: [SECURITY.md](SECURITY.md).

## Tests

```bash
cd backend && npm install && npm test
cd frontend && npm install && npm test
```

- Backend (Jest): checks, among other things, that `k8s/postgres-init-scripts.yaml` matches `backend/migrations/`. Database tests run in memory with pg-mem, without Postgres.
- Frontend (Vitest, React Testing Library): tests the components, including automated accessibility checks with axe. Color contrast can't be checked this way and has to be tested in a browser.

## Folder Structure

```
.
├── frontend/           # React Vite app
├── backend/            # Express API
├── k8s/                # Kubernetes manifests
├── docker-compose.yml
└── .env.example
```

## Development Process

1. Plan first
2. Ask before changing code
3. No unapproved refactoring
4. Persistent data storage
5. Kubernetes with a remote database option

More on how to contribute: [CONTRIBUTING.md](CONTRIBUTING.md). This project follows a [Code of Conduct](CODE_OF_CONDUCT.md).

## License

MIT, see [LICENSE](LICENSE).
