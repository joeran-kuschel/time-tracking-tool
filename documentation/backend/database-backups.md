# Database backups

The database runs inside the local Kubernetes cluster. Its volume lives inside the cluster's node, so a Docker Desktop
update, a cluster reset or deleting the `time-tracking` namespace deletes all data. Hourly backups to a folder on the Mac
protect against that.

## How it works

- The network policy that lets only the backend reach the database doesn't affect backups: the scripts use `kubectl exec`.
- `k8s/backup-db.sh` runs `pg_dump` inside the postgres pod and writes a gzip-compressed dump to the backup folder.
- The dump is only kept if it is complete. pg_dump ends every full dump with `PostgreSQL database dump complete`; a dump
  without that line is discarded and the previous backups stay untouched.
- The newest 168 dumps are kept (one week of hourly backups). Older ones are deleted.
- A launchd job runs the backup every hour and right after the Mac wakes up. It only succeeds while Docker Desktop and the
  cluster are running; failed runs are logged and retried at the next interval.
- The credentials never leave the cluster: the commands run inside the postgres pod, which gets them from
  `postgres-secret`.

Backups contain customer data. They are stored outside the repository and must never be committed.

## Setup

```bash
k8s/install-backup-job.sh              # install the hourly job (runs a first backup right away)
k8s/install-backup-job.sh --uninstall  # remove the job; existing backups are kept
```

## Manual backup and restore

```bash
k8s/backup-db.sh
k8s/restore-db.sh ~/TimeTrackingBackups/time_tracking-20260921-113113.sql.gz
```

A restore replaces **all** current data with the backup, so it asks you to type `restore` first. Pass `--yes` to skip the
question in scripts. The restore runs in a single transaction: if any statement fails, nothing is changed.

### After a cluster reset

1. Deploy the app again (see `CLAUDE.md` or `k8s/README.md`). Postgres starts with an empty schema.
2. Restore the newest backup: `k8s/restore-db.sh "$(ls -1t ~/TimeTrackingBackups/*.sql.gz | head -1)"`.

## Configuration

All scripts read these environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `BACKUP_DIR` | `~/TimeTrackingBackups` | Folder for dumps and `backup.log` |
| `BACKUP_KEEP` | `168` | Number of dumps to keep |
| `KUBE_CONTEXT` | `docker-desktop` | kubectl context of the cluster |
| `NAMESPACE` | `time-tracking` | Namespace of the postgres deployment |

`install-backup-job.sh` stores `BACKUP_DIR`, `KUBE_CONTEXT` and `NAMESPACE` in the launchd job, so run it again after
changing them.

## Checking the backups

```bash
tail ~/TimeTrackingBackups/backup.log
launchctl print gui/$(id -u)/com.timetracking.db-backup | grep -E "state|last exit"
```

## Limits

- A backup contains the password hash and the session hashes (see [Authentication](authentication.md)). They are not
  usable as a password or a session, but keep the backup folder as private as the data. A restore brings back the
  sessions of that time; they end like any other session, and `set-user` ends all of them.

- Up to one hour of data can be lost between two backups.
- No backups are taken while the Mac is off or the cluster is down.
- Backups stay on this Mac. If Time Machine is turned on, it includes the folder; otherwise there is no second copy.

## Tests

`backend/tests/db-backup-scripts.test.js` runs the scripts against a fake `kubectl` and `launchctl`. It covers complete and
incomplete dumps, an unreachable cluster, retention, the restore confirmation and the launchd job.
