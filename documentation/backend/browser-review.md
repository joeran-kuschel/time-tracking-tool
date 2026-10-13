# Reviewing a change in the browser

Every new feature is shown in the browser before it is merged (see `CLAUDE.md`). The review must not touch the real
database of the cluster, so it runs against a throwaway Postgres with sample data. Nothing of it stays behind.

## What runs

| Part | Where | Port |
|---|---|---|
| Frontend (Vite dev server) | the checkout or worktree of the branch | 5173 |
| Backend | the same checkout, started with the environment below | 3000 |
| Throwaway Postgres | a Docker container, deleted when stopped | 55432 |

The dev frontend calls `http://localhost:3000/api` (leave `VITE_API_URL` unset, or set it to that
address). The cluster's backend can't be used for this: it only allows requests from `https://time-tracking.local`
(`CORS_ORIGIN`).

## Steps

1. Start Postgres and apply the schema. `--rm` removes the container, and the data with it, on `docker stop`:

   ```bash
   docker run -d --rm --name ttt-review-db -e POSTGRES_USER=review -e POSTGRES_PASSWORD=review \
     -e POSTGRES_DB=review -p 127.0.0.1:55432:5432 postgres:15-alpine
   for f in backend/migrations/*.sql; do
     docker exec -i ttt-review-db psql -q -U review -d review -v ON_ERROR_STOP=1 < "$f"
   done
   ```

2. Add sample data: at least one customer, a few projects with different hourly rates and some finished entries in
   the current month (`INSERT INTO customers / projects / time_entries` through `docker exec -i ttt-review-db psql`;
   the columns are in [Database](database.md)).
3. Create a login. The tool needs one, even locally. Use a generated test password (never your real one) and keep it
   outside the repository, for example in the session's scratchpad file:

   ```bash
   cd backend
   printf '%s\n%s\n' "$PW" "$PW" | DATABASE_URL=postgres://review:review@127.0.0.1:55432/review DB_SSL=false \
     node src/scripts/set-user.js review-user@example.test
   ```

   `$PW` is the test password. The script asks for it twice on the terminal; piping it, as above, works without
   one. It has to meet the password rule in [Authentication](authentication.md), or the script refuses it.

4. Start the backend with the `DATABASE_URL` above and `CORS_ORIGIN` set to the address of the dev server:

   ```bash
   cd backend && PORT=3000 DB_SSL=false CORS_ORIGIN=http://localhost:5173 \
     DATABASE_URL=postgres://review:review@127.0.0.1:55432/review node src/server.js
   ```

5. Start the frontend: `frontend-dev` in `.claude/launch.json` (`preview_start`). `.claude/launch.json` is not in git,
   so a backend entry for step 4 can be added to it locally.
6. Log in with the test user and check the change, including the keyboard, the language switch and the dark theme.

## Afterwards

Stop both servers, run `docker stop ttt-review-db`, delete the file with the test password, and remove any extra
entries you added to `.claude/launch.json`. The cluster's database is never used for a review, so there is nothing
to clean up in it.

## Branches in a worktree

When a branch is built in a git worktree (for example by an agent), the worktree has no `node_modules`:

- Link the main checkout's `frontend/node_modules` and `backend/node_modules` into it, or run `npm ci`. Never commit
  the links.
- Start the dev server from the worktree's `frontend/` directory (a `launch.json` entry with `cd <worktree>/frontend`)
  on its own port, so that it doesn't collide with `frontend-dev` of the main checkout.
- Run the test suites of several worktrees one after the other. Six suites at the same time made a few backend tests
  fail that pass when run alone.
