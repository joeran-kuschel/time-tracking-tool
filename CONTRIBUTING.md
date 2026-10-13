# Contributing

Thanks for your interest. This is a small project for freelancers; issues and pull requests are welcome.

## Setup

See the [README](README.md) for running the tool locally. Use Node 22.22.2 or newer (`engines` in both `package.json` files).

```bash
cd backend && npm install && npm test
cd frontend && npm install && npm test
```

While working, run only the tests affected by your change, for example
`cd backend && npx jest tests/timeEntry.model.test.js`. Run the entire suite before opening a pull request.

## Rules for changes

- Work in a branch and open a pull request. `main` is protected: it takes no direct pushes, and the checks `backend tests`
  and `frontend tests` have to pass before a pull request can be merged.
- Plan first, and open an issue for larger changes before writing code.
- No refactoring that is unrelated to your change.
- Add tests for everything you implement. Model tests run against pg-mem, so no Postgres is needed.
- Document every feature in `documentation/`: UI chapters in `documentation/ui/`, backend chapters in
  `documentation/backend/`. Documentation, comments and commit messages are in English.
- Add an entry to `Unreleased` in [CHANGELOG.md](CHANGELOG.md), written for the app's user
  ([how](documentation/backend/changelog.md)).
- The UI is available in German and English. Write texts in English in the code, run `npm run extract` in `frontend/`
  or `backend/`, and fill in the German translation in `src/locales/de/messages.po`.
- The UI has to meet WCAG 2.2 level AA: labels, keyboard use, focus, contrast.
- Keep the code lean: no duplicated code and no tight coupling.
- Changes to `backend/migrations/` need `./k8s/generate-init-scripts.sh`; never edit the generated file by hand.
- Never commit real credentials, customer data or exported reports.

## Pull requests

The [pull request template](.github/pull_request_template.md) lists what a reviewer checks. The `Tests` workflow runs
the backend and frontend suites on every pull request.

## Code of conduct

Be respectful. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Report vulnerabilities privately, see [SECURITY.md](SECURITY.md).
