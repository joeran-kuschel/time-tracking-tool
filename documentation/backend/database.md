# Database

PostgreSQL 15 stores all data. By default it runs in the local Kubernetes cluster; a remote database can be used
instead.

## Schema

Defined in `backend/migrations/001_init_schema.sql`, `002_report_status.sql` and `003_one_running_timer.sql`:

| Table | Columns | Relations |
|---|---|---|
| `customers` | `id`, `name`, `email`, `created_at`, `updated_at` | |
| `projects` | `id`, `customer_id`, `name`, `hourly_rate` (decimal 10,2, default 0), `created_at`, `updated_at` | `customer_id` → `customers`, `ON DELETE CASCADE` |
| `time_entries` | `id`, `project_id`, `start_time`, `end_time` (null while running), `description`, `created_at`, `updated_at` | `project_id` → `projects`, `ON DELETE CASCADE` |
| `report_status` | `customer_id`, `year`, `month` (1–12), `status` (`draft`, `ready` or `sent`), `updated_at`; primary key `(customer_id, year, month)` | `customer_id` → `customers`, `ON DELETE CASCADE` |

Indexes: `projects(customer_id)`, `time_entries(project_id)`, `time_entries(start_time)`, and the partial unique index
`one_running_timer`, which allows only one time entry without `end_time` (one running timer, see
[Time entries API](time-entries.md#creating-entries)).

Times are stored as UTC in `TIMESTAMP` columns (without time zone). The backend runs in UTC so that `pg` reads them
back correctly.

## Migrations

- In the cluster, Postgres runs the files from the `postgres-init-scripts` ConfigMap on its **first** start with an
  empty volume. `k8s/generate-init-scripts.sh` generates that ConfigMap (`k8s/postgres-init-scripts.yaml`) from
  `backend/migrations/`. Run it after every change to a migration; a test fails if the two differ.
- An existing volume doesn't run new migrations; apply them by hand. The migrations use `IF NOT EXISTS`, so running
  one twice does no harm. For the in-cluster database, back up first (`k8s/backup-db.sh`), then:
  `kubectl -n time-tracking exec -i deploy/postgres -- psql -U <user> -d <database> < backend/migrations/002_report_status.sql`
  (user and database from the Secret `postgres-secret`).
- `003_one_running_timer.sql` fails on a database that already has more than one running entry. Check first, and stop
  or delete the extra entries before applying it:
  `kubectl -n time-tracking exec deploy/postgres -- sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, project_id, start_time FROM time_entries WHERE end_time IS NULL"'`
- Docker Compose mounts `backend/migrations/` directly as init scripts.

## Connection

| Setting | Where | Meaning |
|---|---|---|
| `DATABASE_URL` | Secret `time-tracking-db` in `k8s/configmap.yaml` | Connection string |
| `DB_SSL` | ConfigMap `time-tracking-config` | `"true"` turns SSL on (for remote databases), `"false"` for the in-cluster Postgres |

SSL is decided by `DB_SSL` alone, not by `NODE_ENV` (`backend/src/config/ssl.js`).

## Using a remote database

1. Set `DATABASE_URL` in the `time-tracking-db` Secret and `DB_SSL: "true"` in the ConfigMap.
2. Apply the schema to the remote database by hand (`backend/migrations/*.sql`).
3. Apply the manifests and restart the backend.

The backend's `wait-for-db` init container still waits for the in-cluster host `postgres`, so with a remote
database the backend currently doesn't start. This is a known open issue.

## Data safety

The in-cluster volume lives inside the Docker Desktop cluster. A Docker Desktop update, a cluster reset or
`kubectl delete namespace time-tracking` deletes it. Hourly backups protect against that: see
[Database backups](database-backups.md).

## Tests

Database tests run against the real schema in pg-mem, an in-memory Postgres (`backend/tests/helpers/testDb.js`).
pg-mem ignores details it can't model, like the `DECIMAL(10, 2)` precision.
