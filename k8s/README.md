# Kubernetes Deployment

Kubernetes Manifests für das Time-Tracking Tool.

## Setup

### 1. Minikube starten

```bash
minikube start
eval $(minikube docker-env)
```

### 2. Docker Images bauen

```bash
cd backend
docker build -t time-tracking-backend:latest .
cd ../frontend
docker build -t time-tracking-frontend:latest .
cd ..
```

### 3. Ressourcen deployen

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres-init-scripts.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
```

### Migrationen

Die Init-Scripts für Postgres (`postgres-init-scripts.yaml`) werden aus `backend/migrations/` generiert.
Nach Änderungen an den Migrationen neu generieren:

```bash
./k8s/generate-init-scripts.sh
```

Postgres führt die Scripts nur beim ersten Start mit leerem Volume aus.

### 4. Status prüfen

```bash
kubectl get all -n time-tracking
kubectl logs -n time-tracking -l app=backend
```

### 5. Zugriff auf App

Mit Minikube:
```bash
minikube service frontend -n time-tracking
```

Mit Port Forward:
```bash
kubectl port-forward -n time-tracking svc/frontend 8080:80
kubectl port-forward -n time-tracking svc/backend 3000:3000
```

Dann: `http://localhost:8080`

## Erlaubte Adressen (CORS_ORIGIN)

Die API nimmt Anfragen aus dem Browser nur von den Adressen an, unter denen das Frontend geöffnet wird. Das hängt von der Installation ab und steht in `configmap.yaml` im ConfigMap `time-tracking-config`, zusammen mit `VITE_API_URL`:

```yaml
data:
  VITE_API_URL: "http://localhost:3000/api"
  CORS_ORIGIN: "http://localhost"            # mehrere Adressen mit Komma trennen
```

Mit Port Forward auf 8080 (siehe oben) gehört `http://localhost:8080` dazu. Ohne `CORS_ORIGIN` kann kein Browser die API nutzen; das Backend schreibt dann beim Start eine Warnung ins Log. Nach einer Änderung:

```bash
kubectl apply -f k8s/configmap.yaml
kubectl rollout restart deployment/backend -n time-tracking
```

## Neue Migrationen auf bestehender Datenbank

Postgres führt die Init-Scripts nur beim ersten Start mit leerem Volume aus. Eine neue Migration muss auf einer bestehenden Datenbank von Hand eingespielt werden, vorher ein Backup machen:

```bash
./k8s/backup-db.sh
kubectl -n time-tracking exec -i deploy/postgres -- sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backend/migrations/003_one_running_timer.sql
```

`003_one_running_timer.sql` erlaubt nur noch einen laufenden Timer. Sie schlägt fehl, wenn schon mehr als ein Eintrag ohne Ende existiert. Vorher prüfen und überzählige Timer stoppen oder löschen:

```bash
kubectl -n time-tracking exec deploy/postgres -- sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, project_id, start_time FROM time_entries WHERE end_time IS NULL"'
```

## Remote PostgreSQL

Um Remote-Datenbank zu nutzen:

1. In `configmap.yaml` das Secret `time-tracking-db` und das ConfigMap anpassen:
```yaml
# Secret time-tracking-db
stringData:
  DATABASE_URL: "postgresql://user:pass@db.example.com:5432/time_tracking"

# ConfigMap time-tracking-config
data:
  DB_SSL: "true"
```

Das Schema muss auf der Remote-Datenbank einmalig selbst angelegt werden
(`backend/migrations/*.sql`), die Init-Scripts laufen nur für die Postgres im Cluster.

2. Neu deployen:
```bash
kubectl apply -f k8s/configmap.yaml
kubectl rollout restart deployment/backend -n time-tracking
```

## Backups

Die Datenbank liegt im Cluster. Ein Docker-Desktop-Update oder ein Cluster-Reset löscht sie. Deshalb gibt es stündliche Backups nach `~/TimeTrackingBackups`:

```bash
./k8s/install-backup-job.sh                # stündliches Backup einrichten
./k8s/backup-db.sh                         # Backup sofort erstellen
./k8s/restore-db.sh <backup.sql.gz>        # Backup zurückspielen (ersetzt alle Daten)
```

Details: `documentation/backend/database-backups.md`

## Cleanup

**Achtung:** Das löscht auch alle Daten in der Datenbank. Vorher ein Backup erstellen.

```bash
./k8s/backup-db.sh
kubectl delete namespace time-tracking
```
