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
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
```

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

## Remote PostgreSQL

Um Remote-Datenbank zu nutzen:

1. ConfigMap aktualisieren in `configmap.yaml`:
```yaml
data:
  DATABASE_URL: "postgresql://user:pass@db.example.com:5432/time_tracking"
```

2. Neu deployen:
```bash
kubectl apply -f k8s/configmap.yaml
kubectl rollout restart deployment/backend -n time-tracking
```

## Cleanup

```bash
kubectl delete namespace time-tracking
```
