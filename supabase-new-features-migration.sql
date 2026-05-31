-- Migration: new features (2026-05-31)
-- Run this in the Supabase SQL editor

-- 1. Portfolio: mark as done
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS is_done boolean DEFAULT false;

-- 2. Photographer: client sees "שלח לצלמת" button only when this is true
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS receive_selection_emails boolean DEFAULT true;
