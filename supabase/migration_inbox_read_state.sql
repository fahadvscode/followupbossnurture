-- SMS inbox read state: track when an agent last viewed a contact+campaign thread
-- Run in Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS drip_inbox_read_state (
  contact_id UUID NOT NULL REFERENCES drip_contacts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES drip_campaigns(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_inbox_read_last_read
  ON drip_inbox_read_state (last_read_at DESC);

ALTER TABLE drip_inbox_read_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON drip_inbox_read_state;
CREATE POLICY "Allow all for anon" ON drip_inbox_read_state FOR ALL TO anon USING (true) WITH CHECK (true);
