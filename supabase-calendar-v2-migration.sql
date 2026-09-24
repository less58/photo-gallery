-- Run this migration in Supabase SQL editor (after supabase-calendar-migration.sql)
-- Adds event/task distinction, completion state, and reminder scheduling

ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'event';
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS reminder_minutes_before INTEGER;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_calendar_events_reminder
  ON calendar_events(reminder_minutes_before, reminder_sent)
  WHERE reminder_minutes_before IS NOT NULL;
