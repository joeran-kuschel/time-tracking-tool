-- Only one timer may run at a time: at most one time entry without an end.
-- The backend checks this before starting a timer; the index also stops two requests that arrive at once.
CREATE UNIQUE INDEX IF NOT EXISTS one_running_timer ON time_entries ((end_time IS NULL)) WHERE end_time IS NULL;
