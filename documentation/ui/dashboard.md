# Dashboard

The Dashboard is the start page. It has three panels (customers, projects, timer) and below them the entries of the
selected project. On narrow screens the panels are stacked.

## Customers

- Lists all customers, sorted by name. Selecting one shows its projects.
- **New customer** + **+ Add** creates a customer with a name. The field keeps its text if saving fails.
- The email address the API supports can't be entered here yet.

## Projects

- Shows the projects of the selected customer, sorted by name, each with its hourly rate, for example `80,00 €/h`
  in German and `€80.00/h` in English.
- Selecting a customer selects its first project, or the project of a running timer.
- **Project name**, **Hourly rate €** and **+ Add** create a project. After adding, the list reloads and the first
  project is selected, not necessarily the new one.

## Timer

See [Timer](timer.md).

## Entries

- Lists all entries of the selected project, newest first: start, end, hours and description.
- A running entry shows **Active** as its end and `0,00 h` / `0.00 h`. It appears as soon as the timer starts.
- Dates and hours follow the language, for example `21.09.2026, 11:52` and `1,50 h` in German, `09/21/2026, 11:52 AM`
  and `1.50 h` in English.
- Entries can't be edited, deleted or added by hand in the UI yet, although the API supports editing and deleting.

## Errors

Loading or saving failures are shown next to the panel they belong to. See [Error messages](error-messages.md).

## Code

`frontend/src/pages/Dashboard.jsx`, `components/EntriesList.jsx`, `format.js`. Tests: `App.test.jsx`,
`components/EntriesList.test.jsx`, `format.test.js`.
