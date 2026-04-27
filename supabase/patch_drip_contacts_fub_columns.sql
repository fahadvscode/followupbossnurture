-- Fix: PGRST204 "Could not find the 'fub_created_via' column of 'drip_contacts'"
-- Run this entire script in Supabase → SQL Editor (safe to re-run).
-- Then retry "Import this lead" / sync-person.

ALTER TABLE drip_contacts ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE drip_contacts ADD COLUMN IF NOT EXISTS fub_created_via TEXT;
ALTER TABLE drip_contacts ADD COLUMN IF NOT EXISTS fub_updated_at TIMESTAMPTZ;
ALTER TABLE drip_contacts ADD COLUMN IF NOT EXISTS fub_last_synced_at TIMESTAMPTZ;
ALTER TABLE drip_contacts ADD COLUMN IF NOT EXISTS fub_snapshot JSONB DEFAULT '{}'::jsonb;

-- Hint PostgREST to refresh the schema cache (Supabase). If this errors, wait ~1 minute and retry the app.
NOTIFY pgrst, 'reload schema';
