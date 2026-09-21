# Dashboard

The Dashboard is the start page. It has three panels (customers, projects, timer) and below them the entries of the
selected project. On narrow screens the panels are stacked.

## Customers

- Lists all customers, sorted by name. Selecting one shows its projects; the selected one is marked with
  `aria-pressed`.
- **Edit** opens a form in place with name and email; **Save**, **Cancel** or Escape close it.
- **Delete** asks in place first (*Delete Muster GmbH and all its projects and time entries?*). This can't be undone.
  While the running timer belongs to the customer, deleting fails with *Stop the running timer first.*
- **New customer** (name, optional email) + **+ Add** creates a customer. The form keeps its values if saving fails.

## Projects

- Shows the projects of the selected customer, sorted by name, each with its hourly rate, for example `80,00 €/h`
  in German and `€80.00/h` in English.
- Selecting a customer selects its first project, or the project of a running timer. After adding, editing or deleting
  a project, the selection stays if the project still exists.
- **Edit** (name, hourly rate) and **Delete** (with its time entries) work like for customers.
- **New project** (name, hourly rate) + **+ Add** creates a project.

## Editing and deleting in general

- Editing opens a form in place and moves focus to its first field. Closing it returns focus to the button that opened
  it.
- The delete confirmation starts on **Cancel**, the safe choice. After deleting, focus moves to the list.
- Renaming a customer or project keeps it selected and shows the new name right away.

## Timer

See [Timer](timer.md).

## Entries

- Lists all entries of the selected project, newest first: start, end, hours and description.
- A running entry shows **Active** as its end and `0,00 h` / `0.00 h`. It appears as soon as the timer starts. It can't
  be edited or deleted; stop the timer first.
- Dates and hours follow the language, for example `21.09.2026, 11:52` and `1,50 h` in German, `09/21/2026, 11:52 AM`
  and `1.50 h` in English.

### Adding time manually

**Add time** (*Zeit nachtragen*) opens a form: project, date, start, end and an optional description. The date starts
as today, the project as the selected one. The end must be after the start, so an entry can't cross midnight;
otherwise the form says *End must be after start.* next to the end field. Overlapping entries are allowed.

### Editing and deleting entries

- **Edit** turns a finished entry's row into the same form, filled with its values. The project dropdown offers the
  projects of the same customer, so an entry booked on the wrong project can be moved.
- An entry the timer recorded past midnight keeps its day offset; its end field then reads *End (next day)*.
- **Delete** asks *Delete the entry from 21.09.2026, 10:00?* first.

## Errors

Loading or saving failures are shown next to the panel they belong to. See [Error messages](error-messages.md).

## Code

- `frontend/src/pages/Dashboard.jsx`: selection (kept as ids), loading and saving
- `components/EditableList.jsx`: the customer and project lists
- `components/RecordForm.jsx`: forms with visible labels, for creating and editing
- `components/EntryForm.jsx`, `entryTime.js`: the time entry form and its local date/time conversion
- `components/EntriesList.jsx`, `components/ConfirmDelete.jsx`, `hooks/useEditable.js`: editing and deleting in place
- Tests: `App.test.jsx` and a test file next to each component and hook
