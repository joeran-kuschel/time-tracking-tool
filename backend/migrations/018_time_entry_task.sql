-- The task of a time entry (#121): the name that entries of one activity share, so reports and invoices can sum the hours
-- per day and task. The description stays free text for the details of one block of work. Empty (NULL) by default, so
-- nothing changes for existing entries.
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS task VARCHAR(100);
-- Task suggestions look up the tasks of one project
CREATE INDEX IF NOT EXISTS idx_time_entries_project_task ON time_entries(project_id, task);
