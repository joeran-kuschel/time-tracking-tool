# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately through
[GitHub's private vulnerability reporting](https://github.com/joeran-kuschel/time-tracking-tool/security/advisories/new).
You can expect a first answer within a week. If that page is not available, open an issue that asks for a private
contact and leave out the details of the problem.

## Important: one user, built for a local machine

The tool is built for one freelancer on a local machine. Every API route except `/health` needs a login: one user, a
password stored as an `scrypt` hash, an `HttpOnly` session cookie and a limit on failed logins (details in
[documentation/backend/authentication.md](documentation/backend/authentication.md)). There is no second factor, no
password reset by email and no more than one user. Do not expose the tool to the internet or an untrusted network.

- Docker Desktop publishes the ingress controller on ports 80 and 443 of all network interfaces, not only `localhost`.
  Other devices on the network can reach the login page. Turn on the firewall (details in [k8s/README.md](k8s/README.md)).
- The cluster serves HTTPS with a certificate from a local CA (`k8s/setup-tls.sh`). Without it, the password would travel
  in clear text.
- `CORS_ORIGIN` limits which web pages may call the API from a browser. It does not protect against other clients; the login does.
- The credentials in the repository (`password`) are local placeholders. Replace them for any other setup, and use
  `DB_SSL=true` with a remote database.

## Supported versions

Only the latest commit on `main` is supported.
