# Deployment

The tool runs on the local Kubernetes cluster of Docker Desktop, in the namespace `time-tracking`.

## Components

| Deployment | Image | Service | Address |
|---|---|---|---|
| `frontend` | `time-tracking-frontend:latest` (nginx serving the Vite build) | LoadBalancer, port 80 | http://localhost |
| `backend` | `time-tracking-backend:latest` (Node.js 24) | LoadBalancer, port 3000 | http://localhost:3000 |
| `postgres` | `postgres:15-alpine` | ClusterIP, port 5432 | inside the cluster only |

- The backend answers `GET /health` with `{"status":"OK"}`; Kubernetes uses it for liveness and readiness probes.
- The API allows requests from any origin (CORS).
- The frontend calls the API at `VITE_API_URL`, built into the image (default `http://localhost:3000/api`).

## Build and deploy

The exact commands are in `CLAUDE.md` (English) and `k8s/README.md` (German). In short:

1. Build both images. The Dockerfiles install exactly the versions in `package-lock.json` (`npm ci`).
2. Load them into the cluster node. Docker Desktop runs Kubernetes in **kind** mode, which has its own image store,
   so `imagePullPolicy: Never` only finds images imported with `ctr images import`.
3. Apply the manifests in this order: `namespace`, `configmap`, `postgres-init-scripts`, `postgres`, `backend`,
   `frontend`.
4. After a new image, restart the deployment: `kubectl -n time-tracking rollout restart deployment/<name>`.

## Configuration

See [Database](database.md) for `DATABASE_URL` and `DB_SSL`. `NODE_ENV` is `production` in the cluster.

## Known issues

- `backend/src/server.js` logs the full `DATABASE_URL`, including the password, at startup.
- Credentials in `k8s/configmap.yaml` are local placeholders (`password`).
