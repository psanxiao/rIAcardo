-- Add full_name column to public.users if it doesn't already exist.
-- Idempotent migration script.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
