# Deployment

The tool runs on the local Kubernetes cluster of Docker Desktop, in the namespace `time-tracking`.

## Components

| Deployment | Image | Service | Address |
|---|---|---|---|
| `frontend` | `time-tracking-frontend:latest` (nginx serving the Vite build) | ClusterIP, port 80 | http://time-tracking.local |
| `backend` | `time-tracking-backend:latest` (Node.js 24) | ClusterIP, port 3000 | http://time-tracking.local/api, `/health` |
| `postgres` | `postgres:15-alpine` | ClusterIP, port 5432 | inside the cluster only |

- The backend answers `GET /health` with `{"status":"OK"}`; Kubernetes uses it for liveness and readiness probes.
- At startup the backend logs which database it uses, with the password replaced by `***`
  (`backend/src/config/redact.js`). Values that aren't a URL with a host are not logged at all, since they could still
  contain the password.
- The frontend calls the API at `VITE_API_URL`, built into the image (default `/api`, the same host as the frontend).
  Docker Compose builds it with `http://localhost:3000/api`, since it publishes the backend on port 3000.
- Browsers may only use the API from the origins in `CORS_ORIGIN` (see below). Request bodies must be JSON; form data
  is not read, because an HTML form on another site could send it without a CORS check.
- The backend runs in UTC (`process.env.TZ` is set in `server.js`). Stored times are UTC, and `pg` reads `TIMESTAMP`
  columns as local time, so another time zone would shift every time. Month limits follow the browser's time zone
  instead, see [Reports API](reports.md#time-zone).

## Hostname (Ingress)

The tool has its own hostname instead of ports on `localhost`, so other apps can run in the same cluster without a
port clash. `k8s/ingress.yaml` serves `time-tracking.local` and routes by path:

| Path | Service |
|---|---|
| `/api` (prefix), `/health` | `backend`, port 3000 |
| everything else | `frontend`, port 80 |

- It needs an ingress controller with the class `nginx`, installed once per cluster (ingress-nginx via Helm, command in
  `CLAUDE.md` and `k8s/README.md`). Docker Desktop publishes its LoadBalancer on localhost ports 80 and 443. Other apps
  add their own Ingress with their own host to the same controller.
- `time-tracking.local` has to point to the Mac: add `127.0.0.1 time-tracking.local` and `::1 time-tracking.local` to
  `/etc/hosts`. Without the `::1` line, macOS first asks the network for the `.local` name (mDNS), which can take a few
  seconds.
- Since frontend and API share the host, the frontend calls the API at the relative path `/api`.
- Tests: `tests/k8s-manifests.test.js` checks the routes, that they point at the services' ports, that the host is the
  allowed CORS origin and that the services are not published on a host port.

## Build and deploy

The exact commands are in `CLAUDE.md` (English) and `k8s/README.md` (German). In short:

1. Build both images. The Dockerfiles install exactly the versions in `package-lock.json` (`npm ci`).
2. Load them into the cluster node. Docker Desktop runs Kubernetes in **kind** mode, which has its own image store,
   so `imagePullPolicy: Never` only finds images imported with `ctr images import`.
3. Install the ingress controller once per cluster, then apply the manifests in this order: `namespace`, `configmap`,
   `postgres-init-scripts`, `postgres`, `backend`, `frontend`, `ingress`.
4. After a new image, restart the deployment: `kubectl -n time-tracking rollout restart deployment/<name>`.

## Configuration

See [Database](database.md) for `DATABASE_URL` and `DB_SSL`. `NODE_ENV` is `production` in the cluster.

`CORS_ORIGIN` depends on where the tool is installed: the addresses the frontend is opened at, comma-separated, for
example `http://localhost` or `https://zeit.example.de,http://localhost:5173`. Only these origins may call the API from
a browser; others get no CORS permission, so a website opened in the same browser can't read or change the data. Set
it together with `VITE_API_URL` and the host in `k8s/ingress.yaml`:

| Where | Setting |
|---|---|
| Kubernetes | ConfigMap `time-tracking-config` in `k8s/configmap.yaml` (default `http://time-tracking.local`) |
| Docker Compose | `CORS_ORIGIN` in `.env` (default `http://localhost`) |
| `npm run dev` | `CORS_ORIGIN` in `backend/.env`, e.g. `http://localhost:5173` for the Vite dev server |

Without `CORS_ORIGIN`, no browser app can use the API, and the backend logs a warning at startup. The CORS setup
(`backend/src/app.js`) also exposes `Content-Disposition`, so the frontend can read a PDF's file name. Tests:
`tests/app.test.js`.

## Known issues

- Credentials in `k8s/configmap.yaml` are local placeholders (`password`).
