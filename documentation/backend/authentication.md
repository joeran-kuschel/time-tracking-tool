# Authentication

The tool has one user. Every API route except the login and `/health` needs a login session. The frontend side is
described in [Login](../ui/login.md).

## Endpoints

| Endpoint | Answer |
|---|---|
| `POST /api/auth/login` with `{ email, password }` | `200` `{ email }` and the session cookie; `400` for a missing or non-text field; `401` `Wrong email or password` (the same for an unknown email and a wrong password); `429` after too many failed logins |
| `POST /api/auth/logout` | `204` always: the session is deleted if there is one, and the cookie removed, also when the cookie is stale or the session has ended |
| `GET /api/auth/me` | `200` `{ email }` of the logged-in user |

Everything else under `/api` answers `401` `Not logged in` without a valid session (`middleware/requireAuth.js`, mounted
in `app.js` before the other routes). `/health` stays open for the Kubernetes probes. Answers of `/api/auth/*` carry
`Cache-Control: no-store`; every answer carries `X-Content-Type-Options: nosniff`.

## Sessions

- The cookie `session` holds a random token (32 bytes, base64url). The database stores only its SHA-256 hash
  (`sessions.token_hash`), so a leaked database or backup doesn't contain a usable token.
- The cookie is `HttpOnly`, `SameSite=Lax`, `Path=/` and `Max-Age` 30 days. It is `Secure` when `NODE_ENV=production`,
  which is the case in the cluster (served over HTTPS, see [Deployment](deployment.md)). Docker Compose and `npm run dev`
  run with `NODE_ENV=development` and use plain `http://localhost`, where Safari refuses `Secure` cookies.
- A session ends after **14 days without a request** (the expiry moves forward with use, at most once per hour) and
  **30 days after the login** in any case. The server enforces both; expired sessions are deleted at the next login.
- A session ends on logout, and for all sessions of the user when the password is changed with the script below.

## Passwords

- Hashed with `scrypt` from `node:crypto` (N=2^17, r=8, p=1, random 16-byte salt, 128 MiB of memory per hash;
  `utils/password.js`). The hash is stored as `scrypt$N$r$p$salt$hash`, so the parameters can be raised later without
  invalidating old hashes. Hashes are computed one at a time: Node would run four in parallel, and four times 128 MiB
  would not fit the backend's memory limit (512Mi). Together with the login rate limit, this also keeps a flood of
  login requests from using up memory.
- A wrong email is checked against a dummy hash, so the answer takes as long as for a wrong password.
- Rule for a new password, checked by the script and never at login: at least 10 characters, a capital letter, a
  number and a special character (anything that is not a letter, a digit or white space).

## The user: `set-user`

There is no sign-up. The script creates the user or changes their password, and ends all their sessions. It asks for
the password on the terminal (not shown, asked twice), so it never appears in a Secret, an argument or the shell history:

```bash
# Kubernetes (needs a terminal: -it)
kubectl -n time-tracking exec -it deploy/backend -- node src/scripts/set-user.js you@example.com
# Docker Compose
docker compose exec backend node src/scripts/set-user.js you@example.com
# npm run dev (DATABASE_URL in backend/.env)
cd backend && npm run set-user -- you@example.com
```

Exit codes: `0` saved, `1` password too weak or the two entries differ (the message names what is missing), `2` missing
or invalid email. Emails are stored in lower case.

## Protection against abuse

- **Brute force:** `express-rate-limit` allows 10 failed logins per 15 minutes, counted for the whole tool, not per
  address: with one user the address says little, and behind the ingress every client may look the same. Successful
  logins don't count. Consequence: someone who keeps failing logins can lock you out of the login for up to 15 minutes.
  The counter is in memory and starts at zero after a backend restart, which is the way out if you are locked out:
  `kubectl -n time-tracking rollout restart deployment/backend`.
- **CSRF:** a request that changes data (not `GET`, `HEAD`, `OPTIONS`) with an `Origin` header that is not in
  `CORS_ORIGIN` answers `403` (`middleware/allowedOrigin.js`). Besides that, bodies are JSON only, so a cross-site
  form can't send one, and the cookie is `SameSite=Lax`.
- **CORS:** `credentials: true`, so the frontend may send the cookie from another origin on `localhost` (Vite dev
  server on `:5173`, Docker Compose on `:80` calling `:3000`). The frontend sends `credentials: 'include'`.

## Database

Migration `004_auth.sql` adds `users` and `sessions` (see [Database](database.md)). An existing database needs the
migration applied by hand, see `k8s/README.md`. The backups contain the password hash and the session hashes
([Database backups](database-backups.md)).

## Not included

- More than one user, sign-up, password reset by email and a "change password" screen (use the script).
- API tokens for scripts.
- Two-factor authentication.

## Tests

- `tests/password.test.js`: hashing, verifying, the password rule.
- `tests/sessionToken.test.js`: tokens, hashes, reading the cookie.
- `tests/auth.model.test.js`: users and sessions on pg-mem, including both expiries and the cascade delete.
- `tests/auth.test.js`: `401` for every route group without a session, `/health` open, login (cookie flags, generic
  errors, timing, validation, rate limit), logout and `me`.
- `tests/app.test.js`: the CORS credentials header and the `Origin` check.
- `tests/set-user.script.test.js`: the script's checks and what it saves.
