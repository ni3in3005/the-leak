-- Add optional pause date (YYYY-MM-DD). NULL means active.
ALTER TABLE subscriptions ADD COLUMN paused_at TEXT;
