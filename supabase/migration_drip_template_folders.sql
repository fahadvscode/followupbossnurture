-- Template folders: organize drip_message_templates into named folders.
-- Run after migration_drip_message_templates.sql (requires drip_message_templates).

CREATE TABLE IF NOT EXISTS drip_template_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drip_template_folders_sort ON drip_template_folders(sort_order, name);

ALTER TABLE drip_message_templates
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES drip_template_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_drip_message_templates_folder ON drip_message_templates(folder_id);

ALTER TABLE drip_template_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon" ON drip_template_folders;

CREATE POLICY "Allow all for anon" ON drip_template_folders FOR ALL TO anon USING (true) WITH CHECK (true);

-- Requires update_drip_updated_at() from main migration.sql.
DROP TRIGGER IF EXISTS drip_template_folders_updated_at ON drip_template_folders;

CREATE TRIGGER drip_template_folders_updated_at
  BEFORE UPDATE ON drip_template_folders
  FOR EACH ROW EXECUTE FUNCTION update_drip_updated_at();
