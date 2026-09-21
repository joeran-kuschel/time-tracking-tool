# Time-Tracking Tool

Ein React-basiertes Time-Tracking-Tool für Freiberufler. Trackt Arbeitszeiten pro Kunde und Projekt, generiert monatliche Berichte als PDF.

## Features (MVP)

- Kunden und Projekte verwalten
- Timer starten/stoppen
- Arbeitszeiten pro Projekt tracken
- Monatliche Abrechnung (CSV/PDF)
- Lokal auf Kubernetes
- Remote-Datenbank-Unterstützung

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Datenbank**: PostgreSQL
- **Container**: Docker
- **Orchestration**: Kubernetes (minikube/Docker Desktop K8s)

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

### 1. Minikube starten

```bash
minikube start
eval $(minikube docker-env)
```

### 2. Images bauen

```bash
docker build -t time-tracking-backend:latest ./backend
docker build -t time-tracking-frontend:latest ./frontend
```

### 3. K8s Ressourcen erstellen

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres-init-scripts.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
```

### 4. Forwarding für lokalen Zugriff

```bash
kubectl port-forward -n time-tracking svc/frontend 8080:80
```

Dann: `http://localhost:8080`

## Remote-Datenbank

Für Production, nutze Remote PostgreSQL:

```bash
DATABASE_URL=postgresql://user:pass@db.example.com:5432/time_tracking docker-compose up
```

Oder in Kubernetes: Aktualisiere das Secret `time-tracking-db` und setze `DB_SSL` im ConfigMap (`k8s/configmap.yaml`):

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
- `GET /api/projects/:customerId` - Projekte eines Kunden
- `POST /api/projects` - Projekt erstellen
- `POST /api/time-entries` - Zeiteintrag starten
- `PATCH /api/time-entries/:id` - Zeiteintrag beenden
- `GET /api/time-entries/:projectId?month=2026-09` - Einträge filtern
- `GET /api/report/:customerId?month=2026-09` - PDF-Report generieren

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
