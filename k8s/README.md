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

The tool runs under its own host name, http://time-tracking.local, instead of on `localhost` ports. This way more apps can run in the same cluster, each with its own host name. For that, the cluster needs an ingress controller with the class `nginx`:

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

### 4. Deploy the resources

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres-init-scripts.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml
```

### Migrations

The init scripts for Postgres (`postgres-init-scripts.yaml`) are generated from `backend/migrations/`.
After changing the migrations, regenerate them:

```bash
./k8s/generate-init-scripts.sh
```

Postgres runs the scripts only on first start with an empty volume.

### 5. Check the status

```bash
kubectl get all -n time-tracking
kubectl logs -n time-tracking -l app=backend
```

### 6. Access the app

Frontend: http://time-tracking.local

The API is at the same address: http://time-tracking.local/api, health check at http://time-tracking.local/health. Frontend and backend have no port of their own on the Mac; `ingress.yaml` forwards `/api` and `/health` to the backend and everything else to the frontend.

**Warning:** Docker Desktop opens ports 80 and 443 of the ingress controller on all network interfaces, not only on `localhost`. Anyone on the same network can reach the API, and it has no login. The macOS firewall is off by default. Turned on (System Settings → Network → Firewall, then "Options…" → "Block all incoming connections"), it should keep other devices out; this is untested.

After building new images:

```bash
kubectl -n time-tracking rollout restart deployment/backend deployment/frontend
```

## Allowed Origins (CORS_ORIGIN)

The API accepts requests from the browser only from the addresses the frontend is opened at. This depends on the installation and is set in `configmap.yaml` in the ConfigMap `time-tracking-config`. A different host name must also be changed in `ingress.yaml`:

```yaml
data:
  CORS_ORIGIN: "http://time-tracking.local"     # separate several addresses with commas
```

The API address (`VITE_API_URL`) is not in the ConfigMap but is written into the frontend image at build time (`docker build --build-arg VITE_API_URL=...`). The default `/api` points to the same host as the frontend and needs no change for a different host name.

Without `CORS_ORIGIN`, no browser can use the API; the backend then logs a warning at startup. After a change:

```bash
kubectl apply -f k8s/configmap.yaml
kubectl rollout restart deployment/backend -n time-tracking
```

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
