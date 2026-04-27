-- Deep FUB sync: full person snapshot, notes, events (run after main migration.sql)

ALTER TABLE drip_contacts ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE drip_contacts ADD COLUMN IF NOT EXISTS fub_created_via TEXT;
ALTER TABLE drip_contacts ADD COLUMN IF NOT EXISTS fub_updated_at TIMESTAMPTZ;
ALTER TABLE drip_contacts ADD COLUMN IF NOT EXISTS fub_last_synced_at TIMESTAMPTZ;
ALTER TABLE drip_contacts ADD COLUMN IF NOT EXISTS fub_snapshot JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS drip_fub_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES drip_contacts(id) ON DELETE CASCADE,
  fub_note_id BIGINT NOT NULL,
  subject TEXT,
  body TEXT,
  is_html BOOLEAN DEFAULT false,
  note_type TEXT,
  created_by TEXT,
  updated_by TEXT,
  fub_created_at TIMESTAMPTZ,
  fub_updated_at TIMESTAMPTZ,
  raw JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contact_id, fub_note_id)
);

CREATE TABLE IF NOT EXISTS drip_fub_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES drip_contacts(id) ON DELETE CASCADE,
  fub_event_id BIGINT NOT NULL,
  event_type TEXT,
  message TEXT,
  description TEXT,
  event_source TEXT,
  occurred_at TIMESTAMPTZ,
  property JSONB,
  raw JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contact_id, fub_event_id)
);

CREATE INDEX IF NOT EXISTS idx_drip_fub_notes_contact ON drip_fub_notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_drip_fub_events_contact ON drip_fub_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_drip_fub_events_occurred ON drip_fub_events(occurred_at DESC);

ALTER TABLE drip_fub_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_fub_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon" ON drip_fub_notes;
DROP POLICY IF EXISTS "Allow all for anon" ON drip_fub_events;

CREATE POLICY "Allow all for anon" ON drip_fub_notes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON drip_fub_events FOR ALL TO anon USING (true) WITH CHECK (true);
