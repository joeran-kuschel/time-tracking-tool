# Documentation

Feature documentation for the time tracking tool, split into UI and Backend. Each feature has its own chapter.

## UI

- [Dashboard](ui/dashboard.md): the start page with timer, key figures, chart, billing and recent entries
- [Time tracking](ui/time-tracking.md): customers, projects, the month summary and the entries of a customer
- [Login](ui/login.md): the login page, the logout button and what happens when a session ends
- [Timer](ui/timer.md): starting and stopping, the running timer across pages and reloads
- [Reports](ui/reports.md): monthly reports, their status and the PDF download
- [Languages](ui/languages.md): German and English, switching without a reload, adding texts
- [Error messages](ui/error-messages.md): how failed requests are shown
- [Accessibility](ui/accessibility.md): what meets WCAG 2.2 AA and what is still missing
- [Design](ui/design.md): colors, the light and dark theme, type, shared styles and the page layout

## Backend

- [Authentication](backend/authentication.md): the single user, sessions, passwords, the `set-user` script and the protection against abuse
- [Customers API](backend/customers.md)
- [Projects API](backend/projects.md)
- [Time entries API](backend/time-entries.md): endpoints, the one-timer rule and how descriptions are kept
- [Reports API](backend/reports.md): monthly reports as JSON and PDF, and the report status
- [Dashboard API](backend/dashboard.md): everything the Dashboard shows in one request
- [Translation](backend/translation.md): the translated PDF report and adding texts
- [Database](backend/database.md): schema, migrations, connection and the remote database option
- [Database backups](backend/database-backups.md): hourly backups of the in-cluster database and how to restore them
- [Deployment](backend/deployment.md): the Kubernetes setup on Docker Desktop, served at https://time-tracking.local
- [Browser review](backend/browser-review.md): reviewing a change in the browser with a throwaway database and sample data
- [Changelog](backend/changelog.md): how `CHANGELOG.md` is kept and checked
- [Repository setup](backend/repository.md): the test workflow on GitHub, issue and pull request templates, contributing and security files
- [Test timing](backend/test-timing.md): how long each test file, the slowest tests and the entire run take
