# Kubernetes Deployment

Kubernetes manifests for the time tracking tool.

## Setup

### 1. Select the cluster

The tool runs in the Kubernetes of Docker Desktop (enable it in the Docker Desktop settings):

```bash
kubectl config use-context docker-desktop
```

### 2. Build the Docker images and load them into the cluster

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

### 3. Install the ingress controller (once per cluster)

The tool runs under its own host name, https://time-tracking.local, instead of on `localhost` ports. This way more apps can run in the same cluster, each with its own host name. For that, the cluster needs an ingress controller with the class `nginx`:

```bash
helm --kube-context docker-desktop upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx --version 4.15.1 \
  --namespace ingress-nginx --create-namespace
```

The name has to point to your Mac. Add it to `/etc/hosts` once (needs sudo). Without the `::1` line, macOS asks the network for `.local` names first, which takes a few seconds:

```bash
sudo sed -i '' '/[[:space:]]time-tracking\.local$/d' /etc/hosts
printf '127.0.0.1 time-tracking.local\n::1 time-tracking.local\n' | sudo tee -a /etc/hosts
```

### 4. Create the TLS certificate (once)

The tool is served over HTTPS; plain HTTP is redirected. [mkcert](https://github.com/FiloSottile/mkcert) makes a certificate that your browsers trust without a warning. The script installs mkcert's local CA (macOS asks for your password once), creates the certificate and stores it as the Secret `time-tracking-tls` that `ingress.yaml` uses. The namespace has to exist first:

```bash
brew install mkcert
kubectl apply -f k8s/namespace.yaml
./k8s/setup-tls.sh
```

Run the script again at any time: it does nothing while the certificate is valid for more than 30 days and creates a new one before that. `./k8s/setup-tls.sh --force` creates a new one anyway; use it after changing the host name, because the script checks only the expiry date. Firefox needs `brew install nss` before the first run to trust the CA. The private key exists only in the cluster, never in the repository.

### 5. Deploy the resources

The Secret from step 4 has to exist before `ingress.yaml` is applied.

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres-init-scripts.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/network-policy-postgres.yaml
kubectl apply -f k8s/network-policy-backend.yaml
```

### Migrations

The init scripts for Postgres (`postgres-init-scripts.yaml`) are generated from `backend/migrations/`.
After changing the migrations, regenerate them:

```bash
./k8s/generate-init-scripts.sh
```

Postgres runs the scripts only on first start with an empty volume.

### 6. Check the status

```bash
kubectl get all -n time-tracking
kubectl logs -n time-tracking -l app=backend
```

### 7. Create the user

Nobody can use the tool before a user exists. The script asks for the password on the terminal (not shown, twice): at least 10 characters with a capital letter, a number and a special character. Once the backend is running (step 6):

```bash
kubectl -n time-tracking exec -it deploy/backend -- node src/scripts/set-user.js you@example.com
```

Run the same command again to change the password; it ends all sessions. More: `documentation/backend/authentication.md`.

### 8. Access the app

Frontend: https://time-tracking.local (http://time-tracking.local redirects to it); log in with the user from step 7

The API is at the same address: https://time-tracking.local/api, health check at https://time-tracking.local/health. Frontend and backend have no port of their own on the Mac; `ingress.yaml` forwards everything to the frontend, whose nginx proxies `/api/` and `/health` to the backend (`frontend/nginx.conf`).

**Other devices:** a phone or another computer trusts the certificate only after mkcert's root CA is installed there. Find the file with `mkcert -CAROOT` (`rootCA.pem`), copy it to the device and install it as a trusted certificate. Never share `rootCA-key.pem`.

**Warning:** Docker Desktop opens ports 80 and 443 of the ingress controller on all network interfaces, not only on `localhost`. Anyone on the same network can reach the login page and the API; without a login session, the API answers `401`. The macOS firewall is off by default. Turned on (System Settings → Network → Firewall, then "Options…" → "Block all incoming connections"), it should keep other devices out; this is untested.

After building new images:

```bash
kubectl -n time-tracking rollout restart deployment/backend deployment/frontend
```

## Network Policy

Two NetworkPolicies limit which pods can open a connection to the backend and to the database. Both are ingress only (no egress rules), select pods by label in the same namespace and are applied last in step 5.

| File | Policy | Allows |
|---|---|---|
| `network-policy-backend.yaml` | `backend-from-frontend` | pods `app: frontend` to the backend, TCP 3000 |
| `network-policy-postgres.yaml` | `postgres-allow-backend` | pods `app: backend` to Postgres, TCP 5432 (the `wait-for-db` init container is part of the backend pod) |

- Everything else is refused (the connection times out): a pod with another label in this namespace and every pod in another namespace. The ingress controller reaches only the frontend, never the backend or the database.
- Docker Desktop's network plugin (kindnet) enforces policies. A cluster without such a plugin ignores them silently.
- **What this does not do:** it does not make `/api` private. Anyone who can open the app can call `/api` through the frontend's nginx, also other devices on the network (see the warning in step 8). The login is what protects the data. The policies do not help if the frontend pod or the node itself is compromised.
- Not affected, because they are no connections between pods: the probes (the kubelet's `httpGet` and `exec` probes) and `kubectl exec`. `backup-db.sh`, `restore-db.sh` and `psql` in this documentation use `kubectl exec` and keep working. A pod started by hand is refused: `kubectl run ... psql -h postgres` times out; use `kubectl exec deploy/postgres -- psql ...` instead.
- A policy applies to new connections only. Restart the backend after applying one.

### Upgrading an Existing Install

The order matters. If the ingress is applied before the new frontend image runs, `/api` hits the old nginx, which answers `index.html` with status 200.

```bash
# 1. Build and load the new frontend image (step 2), then roll it out first
kubectl -n time-tracking rollout restart deployment/frontend
kubectl -n time-tracking rollout status deployment/frontend
# 2. Route everything to the frontend, then add the policies
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/network-policy-postgres.yaml
kubectl apply -f k8s/network-policy-backend.yaml
# 3. Existing connections are not cut off: restart the backend
kubectl -n time-tracking rollout restart deployment/backend
```

Rollback: delete the policies (access is back at once) and/or apply the previous ingress, which routes `/api` and `/health` to the backend again (use it only together with the old frontend image):

```bash
kubectl delete -f k8s/network-policy-backend.yaml -f k8s/network-policy-postgres.yaml
git show <old commit>:k8s/ingress.yaml | kubectl apply -f -
```

### Checking the Policies

Throwaway pods, removed afterwards (`--rm`). The image `postgres:15-alpine` is already in the cluster (the database uses it), hence `IfNotPresent`; its busybox `wget` stands in for curl. `-n` is the namespace, `--restart=Never` makes a plain pod. `-i` instead of `-it`, so the commands also work without a terminal (in scripts).

```bash
# Wrong label, same namespace: both time out
kubectl -n time-tracking run np-wrong --rm -i --restart=Never --image=postgres:15-alpine --image-pull-policy=IfNotPresent -- pg_isready -h postgres -p 5432 -t 5
kubectl -n time-tracking run np-wrong --rm -i --restart=Never --image=postgres:15-alpine --image-pull-policy=IfNotPresent -- wget -T 5 -qO- http://backend:3000/health

# Another namespace: both time out
kubectl create namespace np-test
kubectl -n np-test run np-other --rm -i --restart=Never --image=postgres:15-alpine --image-pull-policy=IfNotPresent -- pg_isready -h postgres.time-tracking -p 5432 -t 5
kubectl -n np-test run np-other --rm -i --restart=Never --image=postgres:15-alpine --image-pull-policy=IfNotPresent -- wget -T 5 -qO- http://backend.time-tracking:3000/health
kubectl delete namespace np-test

# Positive controls: the allowed labels get through. These pods match the Service selectors
# and may briefly receive real traffic, so run them once and let --rm delete them at once
kubectl -n time-tracking run np-backend --labels=app=backend --rm -i --restart=Never --image=postgres:15-alpine --image-pull-policy=IfNotPresent -- pg_isready -h postgres -p 5432 -t 5
kubectl -n time-tracking run np-frontend --labels=app=frontend --rm -i --restart=Never --image=postgres:15-alpine --image-pull-policy=IfNotPresent -- wget -T 5 -qO- http://backend:3000/health

# From outside: 401 without a login, 200 for the health check
curl -k -s -o /dev/null -w '%{http_code}\n' https://time-tracking.local/api/customers
curl -k -s -o /dev/null -w '%{http_code}\n' https://time-tracking.local/health

# Backups use kubectl exec and still work
./k8s/backup-db.sh
```

Afterwards `kubectl -n time-tracking get pods` lists no `np-*` pod and `kubectl get ns` no `np-test`.

## Allowed Origins (CORS_ORIGIN)

The API accepts requests from the browser only from the addresses the frontend is opened at. This depends on the installation and is set in `configmap.yaml` in the ConfigMap `time-tracking-config`. A different host name must also be changed in `ingress.yaml`:

```yaml
data:
  CORS_ORIGIN: "https://time-tracking.local"    # separate several addresses with commas
```

The API address (`VITE_API_URL`) is not in the ConfigMap but is written into the frontend image at build time (`docker build --build-arg VITE_API_URL=...`). The default `/api` points to the same host as the frontend and needs no change for a different host name.

Without `CORS_ORIGIN`, no browser can use the API; the backend then logs a warning at startup. After a change:

```bash
kubectl apply -f k8s/configmap.yaml
kubectl rollout restart deployment/backend -n time-tracking
```

## Upgrading an Existing Install to HTTPS

An install from before TLS needs three steps: create the Secret, then apply the changed manifests and restart the backend, because `CORS_ORIGIN` is now `https://time-tracking.local`:

```bash
./k8s/setup-tls.sh
kubectl apply -f k8s/configmap.yaml -f k8s/ingress.yaml
kubectl rollout restart deployment/backend -n time-tracking
```

Apply the ingress only after the Secret exists; otherwise ingress-nginx serves its own fallback certificate, which browsers reject.

## Upgrading an Existing Install to the Login

An install from before the login has no `users` and `sessions` tables. Back up, apply the migration, rebuild and load the images (step 2), restart, and create the user:

```bash
./k8s/backup-db.sh
kubectl -n time-tracking exec -i deploy/postgres -- sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backend/migrations/004_auth.sql
kubectl -n time-tracking rollout restart deployment/backend deployment/frontend
kubectl -n time-tracking exec -it deploy/backend -- node src/scripts/set-user.js you@example.com
```

Until the user exists, the tool shows the login page and nobody can log in.

## New Migrations on an Existing Database

Postgres runs the init scripts only on first start with an empty volume. A new migration has to be applied by hand to an existing database; make a backup first:

```bash
./k8s/backup-db.sh
kubectl -n time-tracking exec -i deploy/postgres -- sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backend/migrations/003_one_running_timer.sql
```

`003_one_running_timer.sql` allows only one running timer. It fails if more than one entry without an end already exists. Check first and stop or delete the surplus timers:

```bash
kubectl -n time-tracking exec deploy/postgres -- sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, project_id, start_time FROM time_entries WHERE end_time IS NULL"'
```

## Remote PostgreSQL

To use a remote database:

1. In `configmap.yaml`, adjust the Secret `time-tracking-db` and the ConfigMap:
```yaml
# Secret time-tracking-db
stringData:
  DATABASE_URL: "postgresql://user:pass@db.example.com:5432/time_tracking"

# ConfigMap time-tracking-config
data:
  DB_SSL: "true"
```

You have to create the schema on the remote database yourself, once
(`backend/migrations/*.sql`); the init scripts run only for the Postgres in the cluster.

The backend's `wait-for-db` init container waits for the database in `DATABASE_URL`, so it works with the remote one too.

2. Deploy again:
```bash
kubectl apply -f k8s/configmap.yaml
kubectl rollout restart deployment/backend -n time-tracking
```

## Backups

The database lives in the cluster. A Docker Desktop update or a cluster reset deletes it. That is why there are hourly backups to `~/TimeTrackingBackups`:

```bash
./k8s/install-backup-job.sh                # set up the hourly backup
./k8s/backup-db.sh                         # create a backup right now
./k8s/restore-db.sh <backup.sql.gz>        # restore a backup (replaces all data)
```

Details: `documentation/backend/database-backups.md`

## Cleanup

**Warning:** This also deletes all data in the database. Create a backup first.

```bash
./k8s/backup-db.sh
kubectl delete namespace time-tracking
```
