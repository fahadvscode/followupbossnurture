-- Campaign folders: organize drip_campaigns into named folders.
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS drip_campaign_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drip_campaign_folders_sort ON drip_campaign_folders(sort_order, name);

ALTER TABLE drip_campaigns
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES drip_campaign_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_drip_campaigns_folder ON drip_campaigns(folder_id);

ALTER TABLE drip_campaign_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon" ON drip_campaign_folders;

CREATE POLICY "Allow all for anon" ON drip_campaign_folders FOR ALL TO anon USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS drip_campaign_folders_updated_at ON drip_campaign_folders;

CREATE TRIGGER drip_campaign_folders_updated_at
  BEFORE UPDATE ON drip_campaign_folders
  FOR EACH ROW EXECUTE FUNCTION update_drip_updated_at();
