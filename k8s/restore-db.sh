#!/bin/bash
# Restores a dump from backup-db.sh into the in-cluster database. This replaces all current data.
# Usage: k8s/restore-db.sh <backup.sql.gz> [--yes]
set -euo pipefail
source "$(dirname "$0")/db-common.sh"

file="${1:-}"
if [ ! -f "$file" ]; then
  echo "Usage: $0 <backup.sql.gz> [--yes]" >&2
  exit 1
fi

if [ "${2:-}" != "--yes" ]; then
  read -r -p "This replaces all data in $NAMESPACE with $file. Type 'restore' to continue: " answer || answer=""
  if [ "$answer" != "restore" ]; then
    echo "Aborted" >&2
    exit 1
  fi
fi

# The dump runs inside one transaction that this script opens and closes itself. If the stream from kubectl is cut
# off anywhere, COMMIT never arrives and the database rolls back. psql alone cannot tell a cut from a clean end of
# input (--single-transaction would commit a partial restore when the cut falls on a statement boundary).
# COMMIT comes before the marker: a marker without a commit would claim a restore that did not happen.
restore_stream() {
  echo 'BEGIN;'
  # set -e does not apply inside the caller's if, so a damaged file must stop the stream here, before COMMIT
  gzip -dc "$file" || return 1
  echo
  echo 'COMMIT;'
  echo "SELECT 'restore-complete';"
}

if ! output=$(restore_stream | pg_exec 'psql -v ON_ERROR_STOP=1 -q -At -U "$POSTGRES_USER" -d "$POSTGRES_DB"'); then
  echo "Restore failed. The database was not changed: it is rolled back unless the error came after the commit." >&2
  exit 1
fi
if ! grep -qx 'restore-complete' <<< "$output"; then
  echo "Restore incomplete: the end of the data stream was not confirmed, so the restore was most likely not committed." >&2
  echo "Run it again. If it keeps failing, check the cluster. (Only a cut exactly after COMMIT leaves a full restore; the row counts show it.)" >&2
  exit 1
fi
echo "Restored $file"

# Row counts of every table, so you can see what came back (the query goes in on stdin, which avoids shell quoting)
# The restore is done by now, so a failing count query only gets a note and does not change the exit code
pg_exec 'psql -At -F ": " -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL' || echo "Could not read the row counts, but the restore is complete." >&2
SELECT table_name,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY 1;
SQL
