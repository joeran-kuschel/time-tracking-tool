# Documentation

Feature documentation for the time tracking tool, split into UI and Backend. Each feature has its own chapter.

## UI

- [Dashboard](ui/dashboard.md): customers, projects and the entries of a project
- [Timer](ui/timer.md): starting and stopping, the running timer across pages and reloads
- [Reports](ui/reports.md): monthly reports and the PDF download
- [Languages](ui/languages.md): German and English, switching without a reload, adding texts
- [Error messages](ui/error-messages.md): how failed requests are shown
- [Accessibility](ui/accessibility.md): what meets WCAG 2.2 AA and what is still missing

## Backend

- [Customers API](backend/customers.md)
- [Projects API](backend/projects.md)
- [Time entries API](backend/time-entries.md): endpoints, the one-timer rule and how descriptions are kept
- [Reports API](backend/reports.md): monthly reports as JSON and PDF
- [Translation](backend/translation.md): the translated PDF report and adding texts
- [Database](backend/database.md): schema, migrations, connection and the remote database option
- [Database backups](backend/database-backups.md): hourly backups of the in-cluster database and how to restore them
- [Deployment](backend/deployment.md): the Kubernetes setup on Docker Desktop
