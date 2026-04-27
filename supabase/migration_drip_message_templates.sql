-- Reusable SMS / email templates + HTML body support on email steps
-- Run in Supabase SQL Editor (safe to re-run with IF NOT EXISTS patterns below)

CREATE TABLE IF NOT EXISTS drip_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  email_subject TEXT NOT NULL DEFAULT '',
  body_plain TEXT NOT NULL DEFAULT '',
  body_html TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drip_message_templates_channel ON drip_message_templates(channel);

ALTER TABLE drip_campaign_steps
  ADD COLUMN IF NOT EXISTS email_body_format TEXT NOT NULL DEFAULT 'plain';

ALTER TABLE drip_campaign_steps DROP CONSTRAINT IF EXISTS drip_campaign_steps_email_body_format_check;

ALTER TABLE drip_campaign_steps
  ADD CONSTRAINT drip_campaign_steps_email_body_format_check
  CHECK (email_body_format IN ('plain', 'html'));

ALTER TABLE drip_message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon" ON drip_message_templates;

CREATE POLICY "Allow all for anon" ON drip_message_templates FOR ALL TO anon USING (true) WITH CHECK (true);

-- Requires update_drip_updated_at() from main migration.sql (or create it first).
DROP TRIGGER IF EXISTS drip_message_templates_updated_at ON drip_message_templates;

CREATE TRIGGER drip_message_templates_updated_at
  BEFORE UPDATE ON drip_message_templates
  FOR EACH ROW EXECUTE FUNCTION update_drip_updated_at();
