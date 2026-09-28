# Time-Tracking Tool

Ein React-basiertes Time-Tracking-Tool für Freiberufler. Trackt Arbeitszeiten pro Kunde und Projekt, generiert monatliche Berichte als PDF.

## Features (MVP)

- Kunden und Projekte verwalten
- Timer starten/stoppen
- Arbeitszeiten pro Projekt tracken
- Monatliche Abrechnung (PDF)
- Deutsch und Englisch, Sprachwechsel ohne Neuladen
- Lokal auf Kubernetes
- Remote-Datenbank-Unterstützung
- Stündliche Datenbank-Backups

Ausführliche Dokumentation (Englisch) aller Features: [`documentation/`](documentation/README.md)

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Datenbank**: PostgreSQL
- **Container**: Docker
- **Orchestration**: Kubernetes (Docker Desktop)

## Quick Start (Lokal)

### 1. Repository klonen und Setup

```bash
git clone <repo-url>
cd time-tracking-tool
cp .env.example .env
```

### 2. Mit Docker Compose starten

```bash
docker-compose up -d
```

Das startet:
- PostgreSQL (Port 5432)
- Backend (Port 3000)
- Frontend (Port 5173 oder über nginx Port 80)

### 3. Browser öffnen

```
http://localhost
```

## Kubernetes Deployment (Lokal)

### 1. Cluster auswählen

```bash
kubectl config use-context docker-desktop
```

### 2. Images bauen und in den Cluster laden

```bash
docker build -t time-tracking-backend:latest ./backend
docker build -t time-tracking-frontend:latest ./frontend
```

Docker Desktop betreibt Kubernetes im kind-Modus mit eigenem Image-Speicher. Wegen `imagePullPolicy: Never` müssen die Images in den Cluster-Knoten importiert werden:

```bash
for img in time-tracking-backend time-tracking-frontend; do
  docker save "${img}:latest" | docker exec -i desktop-control-plane ctr --namespace k8s.io images import -
done
```

### 3. K8s Ressourcen erstellen

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres-init-scripts.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml
```

Vorher einmal pro Cluster den Ingress-Controller installieren und `time-tracking.local` in `/etc/hosts` eintragen, siehe `k8s/README.md`.

Nach neuen Images:

```bash
kubectl -n time-tracking rollout restart deployment/backend deployment/frontend
```

**Achtung:** Docker Desktop öffnet die Ports 80 und 443 auf allen Netzwerkschnittstellen. Wer im selben Netzwerk ist, erreicht damit die API, und die hat keinen Login. Details und Firewall: `k8s/README.md`.

### 4. Browser öffnen

http://time-tracking.local

## Remote-Datenbank

Für Production, nutze Remote PostgreSQL:

```bash
DATABASE_URL=postgresql://user:pass@db.example.com:5432/time_tracking docker-compose up
```

Oder in Kubernetes: Aktualisiere das Secret `time-tracking-db` und setze `DB_SSL` in der ConfigMap (`k8s/configmap.yaml`):

```yaml
stringData:
  DATABASE_URL: "postgresql://user:pass@db.example.com:5432/time_tracking"
```

```yaml
data:
  DB_SSL: "true"
```

## Datenbank-Schema

- `customers`: Kundenverwaltung
- `projects`: Kundenprojekte
- `time_entries`: Zeiteintrage

## API Endpoints

- `GET /api/customers` - Alle Kunden
- `POST /api/customers` - Kunde erstellen
- `GET /api/projects/customer/:customerId` - Projekte eines Kunden
- `POST /api/projects` - Projekt erstellen
- `GET /api/time-entries/active` - Laufender Timer
- `POST /api/time-entries` - Zeiteintrag starten
- `PATCH /api/time-entries/:id` - Zeiteintrag beenden
- `GET /api/time-entries/project/:projectId` - Einträge eines Projekts
- `GET /api/reports/customer/:customerId?month=9&year=2026` - Monatsbericht (JSON)
- `GET /api/reports/customer/:customerId/pdf?month=9&year=2026&lang=de` - Monatsbericht als PDF

Alle Endpunkte mit Details: `documentation/backend/`

## Tests

```bash
cd backend && npm install && npm test
cd frontend && npm install && npm test
```

- Backend (Jest): prüft u. a., dass `k8s/postgres-init-scripts.yaml` mit `backend/migrations/` übereinstimmt. Datenbank-Tests laufen mit pg-mem im Speicher, ohne Postgres.
- Frontend (Vitest, React Testing Library): prüft Komponenten inkl. automatischer Barrierefreiheits-Checks mit axe. Farbkontraste lassen sich so nicht prüfen, die müssen im Browser getestet werden.

## Ordnerstruktur

```
.
├── frontend/           # React Vite App
├── backend/            # Express API
├── k8s/                # Kubernetes Manifests
├── docker-compose.yml
└── .env.example
```

## Entwicklungsprozess

1. Plan first
2. Fragen, bevor Code geändert wird
3. Keine ungenehmigten Refactorings
4. Persistente Datenspeicherung
5. K8s mit Remote-DB-Option

## Lizenz

MIT
