-- Run this migration in Supabase SQL editor (after the previous calendar migrations)
-- Lets each photographer customize their calendar category colors

ALTER TABLE photographers ADD COLUMN IF NOT EXISTS calendar_category_colors JSONB;
