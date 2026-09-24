-- Run this migration in Supabase SQL editor
-- Photographer's calendar: events/tasks per date, shown with Hebrew + Gregorian dates

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id UUID NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_time TEXT,
  title TEXT NOT NULL,
  notes TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_photographer_date ON calendar_events(photographer_id, event_date);
