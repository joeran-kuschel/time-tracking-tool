# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately through
[GitHub's private vulnerability reporting](https://github.com/joeran-kuschel/time-tracking-tool/security/advisories/new).
You can expect a first answer within a week. If that page is not available, open an issue that asks for a private
contact and leave out the details of the problem.

## Important: the API has no login

The tool is built for one freelancer on a local machine. The API has **no authentication**, so anyone who can reach it
can read and change all data. Do not expose it to the internet or an untrusted network.

- Docker Desktop publishes the ingress controller on ports 80 and 443 of all network interfaces, not only `localhost`.
  Turn on the firewall (details in [k8s/README.md](k8s/README.md)).
- `CORS_ORIGIN` limits which web pages may call the API from a browser. It does not protect against other clients.
- The credentials in the repository (`password`) are local placeholders. Replace them for any other setup, and use
  `DB_SSL=true` with a remote database.

## Supported versions

Only the latest commit on `main` is supported.
