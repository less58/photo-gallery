-- Add is_frozen column to photographers table
-- Run this in your Supabase SQL Editor

alter table public.photographers
  add column if not exists is_frozen boolean not null default false;
