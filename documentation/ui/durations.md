# Durations

Every duration on the Dashboard, the Time tracking page and the Entries page is shown as hours and minutes: `3:59 h`,
`0:05 h`, `123:45 h`. Minutes always have two digits, hours have no upper limit, and the format is the same in German and
English. A duration that is negative (an old entry that ends before it starts) has a minus sign: `-1:30 h`. The unit
`h` tells a duration from the clock times next to it (`09:00 – 10:05`).

The Reports page and the PDF show `h:mm h` too, and their amounts are calculated from the same whole minutes (rate ×
minutes / 60, rounded to cents per entry, so time × rate equals the amount). Only the CSV keeps its Hours column as a
decimal number, so a spreadsheet can add it up. The timer (`HH:MM:SS`), clock times, hourly rates and the time fields of the entry form are not durations in this
sense and stay as they are.

## Whole minutes

An entry's duration is rounded to whole minutes before it is shown (30 seconds and more count as a minute). Totals add
up these shown minutes, never the exact seconds, so the rows of a list always add up exactly to their total: per
project, per customer, per day. With a rounding rule ([Settings](settings.md)) the billed time is first rounded by the
rule and then shown, so six entries rounded to 10 minutes show `1:00 h` together, twelve entries of 5 minutes too
(the Reports page and the PDF too). The tracked time stays exact, in the sense
that nothing is rounded by a rule.

## Where

| Page | Durations |
|---|---|
| Dashboard | *This week*, *This month* and the average per working day, the chart (value of a bar, month total, data table), *By customer*, *Billing*, recent entries, the message after stopping the timer (*Saved 1:05 h to …*) |
| Time tracking | month summary (hours, hours per project), the hours of each entry, the total in each project's heading |
| Entries | the hours of each result and the number of hours found |
| Reports | the total, the project lines and the hours of each entry; the PDF the same |

The chart's bar heights and scale are still in hours; only its texts use `h:mm`.

## Accessibility

A duration in a table cell or a figure is wrapped in `<time datetime="PT3H59M">`, so assistive technology can tell it
from a time of day. A negative duration is plain text (a negative value is not valid in `datetime`).

## In the code

- `formatDuration(i18n, minutes)` in `frontend/src/format.js` makes the text; `components/Duration.jsx` adds the
  `<time>` element. `minutesBetween(start, end)` gives an entry's whole minutes (0 for a running one);
  `minutesOfHours(hours)` converts decimal hours from the server (`billed_hours`, the `hours` of the entry search).
- `summary.js` and `dashboard.js` count in minutes (`minutes` instead of `hours`), the amounts still come from hours.
- The JSON API stays in decimal hours. The entry search (`GET /api/time-entries/search`) adds up the entries rounded to
  whole minutes, so its `hours` equals the minutes the page shows ([Time entries](../backend/time-entries.md)).
