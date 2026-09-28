# Kubernetes Deployment

Kubernetes Manifests für das Time-Tracking Tool.

## Setup

### 1. Cluster auswählen

Das Tool läuft im Kubernetes von Docker Desktop (in den Docker-Desktop-Einstellungen aktivieren):

```bash
kubectl config use-context docker-desktop
```

### 2. Docker Images bauen und in den Cluster laden

```bash
docker build -t time-tracking-backend:latest ./backend
docker build -t time-tracking-frontend:latest ./frontend
```

Docker Desktop betreibt Kubernetes im kind-Modus mit eigenem Image-Speicher. Wegen `imagePullPolicy: Never` müssen die Images deshalb in den Cluster-Knoten importiert werden:

```bash
for img in time-tracking-backend time-tracking-frontend; do
  docker save "${img}:latest" | docker exec -i desktop-control-plane ctr --namespace k8s.io images import -
done
```

### 3. Ingress-Controller installieren (einmal pro Cluster)

Das Tool läuft unter einem eigenen Hostnamen, http://time-tracking.local, statt auf Ports von `localhost`. So können weitere Apps im selben Cluster laufen, jede mit eigenem Hostnamen. Dafür braucht der Cluster einen Ingress-Controller mit der Klasse `nginx`:

```bash
helm --kube-context docker-desktop upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx --version 4.15.1 \
  --namespace ingress-nginx --create-namespace
```

Der Name muss auf den Mac zeigen. Einmalig in `/etc/hosts` eintragen (braucht sudo). Ohne die `::1`-Zeile fragt macOS bei `.local`-Namen erst im Netzwerk nach, das dauert einige Sekunden:

```bash
sudo sed -i '' '/[[:space:]]time-tracking\.local$/d' /etc/hosts
printf '127.0.0.1 time-tracking.local\n::1 time-tracking.local\n' | sudo tee -a /etc/hosts
```

### 4. Ressourcen deployen

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres-init-scripts.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml
```

### Migrationen

Die Init-Scripts für Postgres (`postgres-init-scripts.yaml`) werden aus `backend/migrations/` generiert.
Nach Änderungen an den Migrationen neu generieren:

```bash
./k8s/generate-init-scripts.sh
```

Postgres führt die Scripts nur beim ersten Start mit leerem Volume aus.

### 5. Status prüfen

```bash
kubectl get all -n time-tracking
kubectl logs -n time-tracking -l app=backend
```

### 6. Zugriff auf App

Frontend: http://time-tracking.local

Die API liegt unter derselben Adresse: http://time-tracking.local/api, Health-Check unter http://time-tracking.local/health. Frontend und Backend haben keinen eigenen Port auf dem Mac; `ingress.yaml` leitet `/api` und `/health` ans Backend weiter, alles andere ans Frontend.

**Achtung:** Docker Desktop öffnet die Ports 80 und 443 des Ingress-Controllers auf allen Netzwerkschnittstellen, nicht nur auf `localhost`. Wer im selben Netzwerk ist, erreicht damit die API, und die hat keinen Login. Nur die macOS-Firewall (eingehende Verbindungen blockieren) hält andere Geräte fern.

Nach neuen Images:

```bash
kubectl -n time-tracking rollout restart deployment/backend deployment/frontend
```

## Erlaubte Adressen (CORS_ORIGIN)

Die API nimmt Anfragen aus dem Browser nur von den Adressen an, unter denen das Frontend geöffnet wird. Das hängt von der Installation ab und steht in `configmap.yaml` im ConfigMap `time-tracking-config`. Ein anderer Hostname muss auch in `ingress.yaml` geändert werden:

```yaml
data:
  CORS_ORIGIN: "http://time-tracking.local"     # mehrere Adressen mit Komma trennen
```

Die Adresse der API (`VITE_API_URL`) steht nicht im ConfigMap, sondern wird beim Bauen ins Frontend-Image geschrieben (`docker build --build-arg VITE_API_URL=...`). Der Standard `/api` zeigt auf denselben Host wie das Frontend und muss bei einem anderen Hostnamen nicht geändert werden.

Ohne `CORS_ORIGIN` kann kein Browser die API nutzen; das Backend schreibt dann beim Start eine Warnung ins Log. Nach einer Änderung:

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
