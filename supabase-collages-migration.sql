-- Run this migration in Supabase SQL editor

CREATE TABLE IF NOT EXISTS collage_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id UUID NOT NULL,
  name TEXT NOT NULL,
  cells JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'קולאג׳',
  cells JSONB NOT NULL DEFAULT '[]',
  border_enabled BOOLEAN DEFAULT FALSE,
  border_color TEXT DEFAULT '#ffffff',
  border_width INTEGER DEFAULT 4,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collages_portfolio_id ON collages(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_collage_templates_photographer_id ON collage_templates(photographer_id);
