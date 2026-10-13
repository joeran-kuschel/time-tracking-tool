# Deployment

The tool runs on the local Kubernetes cluster of Docker Desktop, in the namespace `time-tracking`.

## Components

| Deployment | Image | Service | Address |
|---|---|---|---|
| `frontend` | `time-tracking-frontend:latest` (nginx serving the Vite build) | ClusterIP, port 80 | https://time-tracking.local |
| `backend` | `time-tracking-backend:latest` (Node.js 24) | ClusterIP, port 3000 | https://time-tracking.local/api, `/health` |
| `postgres` | `postgres:15-alpine` | ClusterIP, port 5432 | inside the cluster only |

- The backend answers `GET /health` with `{"status":"OK"}`; Kubernetes uses it for liveness and readiness probes.
- At startup the backend logs which database it uses, with the password replaced by `***`
  (`backend/src/config/redact.js`). Values that aren't a URL with a host are not logged at all, since they could still
  contain the password.
- The frontend calls the API at `VITE_API_URL`, a build argument of the frontend image (default `/api`, the same host
  as the frontend), not a ConfigMap value. Docker Compose builds it with `http://localhost:3000/api`, since it publishes
  the backend on port 3000.
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
  `CLAUDE.md` and `k8s/README.md`). Other apps add their own Ingress with their own host to the same controller.
- Docker Desktop publishes the controller's LoadBalancer on ports 80 and 443 of **all network interfaces**, not only
  localhost. Anyone on the same network who sends `Host: time-tracking.local` reaches the API, which has no login.
  The macOS firewall is off by default. Turned on with "Block all incoming connections", it should keep them out,
  but that is untested.
- `time-tracking.local` has to point to the Mac: add `127.0.0.1 time-tracking.local` and `::1 time-tracking.local` to
  `/etc/hosts`. Without the `::1` line, macOS first asks the network for the `.local` name (mDNS), which can take a few
  seconds.
- Since frontend and API share the host, the frontend calls the API at the relative path `/api`.
- The ingress terminates TLS (HTTPS on port 443); frontend and backend stay plain HTTP inside the cluster. The `tls:`
  block uses the Secret `time-tracking-tls`, which `k8s/setup-tls.sh` creates with a certificate from
  [mkcert](https://github.com/FiloSottile/mkcert) (the script's steps, renewal and other devices: `k8s/README.md`).
  The annotation `ssl-redirect: "true"` redirects plain HTTP to HTTPS. The key lives only in the cluster; `*.pem` and
  `*.key` are in `.gitignore` as a safety net. Docker Compose and `npm run dev` stay on `http://localhost`, which
  browsers treat as a secure context.
- `setup-tls.sh` does nothing while the Secret's certificate is valid for more than 30 days (`--force` creates a new
  one; use it after changing the host, because only the expiry is checked). It must run before the ingress is applied,
  otherwise ingress-nginx serves its own fallback certificate.
- Tests: `tests/k8s-manifests.test.js` checks the routes, that they point at the services' ports, that the host (over
  `https`) is the allowed CORS origin, that TLS and the redirect are set and the Secret name matches the script, that
  the services are not published on a host port and that the frontend image calls `/api`.
  `tests/tls-setup-script.test.js` runs `setup-tls.sh` against a fake `kubectl`, `mkcert` and `openssl`: creating the
  Secret, skipping while it is valid, renewing when it expires, `--force`, rejecting unknown arguments, the environment
  settings, stopping before the trust store is touched when the cluster is unreachable, that the temporary key files
  are removed (also on failure) and the hint when `mkcert` is missing.

## Build and deploy

The exact commands are in `CLAUDE.md` and `k8s/README.md`. In short:

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
it together with the host in `k8s/ingress.yaml`:

| Where | Setting |
|---|---|
| Kubernetes | ConfigMap `time-tracking-config` in `k8s/configmap.yaml` (default `https://time-tracking.local`) |
| Docker Compose | `CORS_ORIGIN` in `.env` (default `http://localhost`) |
| `npm run dev` | `CORS_ORIGIN` in `backend/.env`, e.g. `http://localhost:5173` for the Vite dev server |

Without `CORS_ORIGIN`, no browser app can use the API, and the backend logs a warning at startup. The CORS setup
(`backend/src/app.js`) also exposes `Content-Disposition`, so the frontend can read a PDF's file name. Tests:
`tests/app.test.js`.

## Known issues

- Credentials in `k8s/configmap.yaml` are local placeholders (`password`).
