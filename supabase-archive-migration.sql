-- Run this in Supabase SQL editor
-- Stores a snapshot of client selections before portfolio/photo deletion

CREATE TABLE IF NOT EXISTS selection_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id uuid REFERENCES photographers(id) ON DELETE CASCADE,
  portfolio_id uuid,
  portfolio_title text NOT NULL,
  client_email text NOT NULL,
  approved_count int NOT NULL DEFAULT 0,
  selections_json jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  downloaded_at timestamptz
);

CREATE INDEX IF NOT EXISTS selection_snapshots_photographer_id_idx ON selection_snapshots(photographer_id);

-- Reset old email templates so the new default template appears in settings
-- (only resets accounts that still have the old default text, not custom text)
UPDATE photographers
SET email_subject = NULL, email_body = NULL
WHERE email_body LIKE '%התמונות שלך מוכנות לבחירה!%'
  AND email_body LIKE '%בברכה%'
  AND email_body NOT LIKE '%הגלריה%';
