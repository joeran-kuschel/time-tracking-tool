# Repository setup

What the repository contains for contributors and for the public GitHub page.

## Continuous integration

`.github/workflows/test.yml` runs the `Tests` workflow on every push to `main` and on every pull request. One job with a
matrix runs for each package (`backend`, `frontend`) in parallel: `npm ci`, then `npm test` on Node 22. The workflow only has read
access to the repository (`permissions: contents: read`). A failing job fails the check.

## Dependency updates

`.github/dependabot.yml` has Dependabot check once a week for new versions of the backend packages, the frontend
packages and the GitHub Actions in the workflow. Minor and patch updates of one ecosystem come as a single pull
request; the `Tests` workflow runs on it like on any other. Major updates of `vite`, `vitest` and `@lingui/*` are
ignored on purpose: Vite 4 and Vitest 0.34 are pinned, and Lingui 6 needs Vite 6 or newer (see `CLAUDE.md`).

Version updates need no setting. Dependabot alerts and security updates are switched on in the repository's security
settings; the file does not enable them.

## Templates

- `.github/ISSUE_TEMPLATE/`: bug report and feature request. Blank issues are off; the contact link sends
  vulnerabilities to GitHub's private reporting.
- `.github/pull_request_template.md`: the checklist from `CONTRIBUTING.md` (tests, documentation, changelog,
  translations, accessibility).

## Community files

- `CONTRIBUTING.md`: setup and the rules for changes.
- `SECURITY.md`: how to report a vulnerability, and the warning that the API has no login. Private vulnerability
  reporting has to be switched on in the repository's security settings, or the report link shows a 404.
- `LICENSE`: MIT.

## Test

`backend/tests/github-config.test.js` checks that the workflow is valid YAML, runs both test suites with `npm ci`, has
read-only permissions and uses Node 22 or newer; that the issue templates have a name and a label; that
Dependabot covers both packages and the workflow and keeps the pinned major versions; that the files
named above exist; and that relative links in `README.md`, `CONTRIBUTING.md`, `SECURITY.md` and the pull request
template point to existing files.
