-- Follow Up Boss Drip Campaign Platform
-- All tables prefixed with drip_ to avoid collision with existing tables

CREATE TABLE IF NOT EXISTS drip_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fub_id INTEGER UNIQUE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  source TEXT,
  source_category TEXT DEFAULT 'Other',
  source_detail TEXT,
  tags TEXT[] DEFAULT '{}',
  stage TEXT,
  assigned_agent TEXT,
  custom_fields JSONB DEFAULT '{}',
  opted_out BOOLEAN DEFAULT false,
  fub_created_at TIMESTAMPTZ,
  source_url TEXT,
  fub_created_via TEXT,
  fub_updated_at TIMESTAMPTZ,
  fub_last_synced_at TIMESTAMPTZ,
  fub_snapshot JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drip_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_tags TEXT[] DEFAULT '{}',
  trigger_sources TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  twilio_from_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drip_campaign_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES drip_campaigns(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0,
  delay_hours INTEGER NOT NULL DEFAULT 0,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  message_template TEXT NOT NULL DEFAULT '',
  step_type TEXT NOT NULL DEFAULT 'sms' CHECK (step_type IN ('sms', 'email', 'fub_action_plan', 'fub_task')),
  email_subject_template TEXT NOT NULL DEFAULT '',
  email_body_format TEXT NOT NULL DEFAULT 'plain' CHECK (email_body_format IN ('plain', 'html')),
  fub_action_plan_id INTEGER,
  fub_task_type TEXT NOT NULL DEFAULT 'Call',
  fub_task_name_template TEXT NOT NULL DEFAULT '',
  fub_due_offset_minutes INTEGER NOT NULL DEFAULT 0,
  fub_assigned_user_id INTEGER,
  fub_remind_seconds_before INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, step_number)
);

CREATE TABLE IF NOT EXISTS drip_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES drip_contacts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES drip_campaigns(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'opted_out')),
  current_step INTEGER DEFAULT 0,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(contact_id, campaign_id)
);

CREATE TABLE IF NOT EXISTS drip_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES drip_enrollments(id) ON DELETE SET NULL,
  contact_id UUID NOT NULL REFERENCES drip_contacts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES drip_campaigns(id) ON DELETE SET NULL,
  step_number INTEGER,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  body TEXT NOT NULL,
  twilio_sid TEXT,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'received')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drip_opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES drip_contacts(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  reason TEXT,
  opted_out_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drip_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'webhook', 'manual')),
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  contacts_synced INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error TEXT
);

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

CREATE TABLE IF NOT EXISTS drip_template_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drip_template_folders_sort ON drip_template_folders(sort_order, name);

CREATE TABLE IF NOT EXISTS drip_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES drip_template_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  email_subject TEXT NOT NULL DEFAULT '',
  body_plain TEXT NOT NULL DEFAULT '',
  body_html TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drip_message_templates_channel ON drip_message_templates(channel);
CREATE INDEX IF NOT EXISTS idx_drip_message_templates_folder ON drip_message_templates(folder_id);

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_drip_contacts_fub_id ON drip_contacts(fub_id);
CREATE INDEX IF NOT EXISTS idx_drip_contacts_phone ON drip_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_drip_contacts_source_category ON drip_contacts(source_category);
CREATE INDEX IF NOT EXISTS idx_drip_contacts_opted_out ON drip_contacts(opted_out);
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_status ON drip_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_contact ON drip_enrollments(contact_id);
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_campaign ON drip_enrollments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_drip_messages_contact ON drip_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_drip_messages_campaign ON drip_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_drip_messages_enrollment ON drip_messages(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_drip_messages_direction ON drip_messages(direction);
CREATE INDEX IF NOT EXISTS idx_drip_messages_twilio_sid ON drip_messages(twilio_sid);
CREATE INDEX IF NOT EXISTS idx_drip_opt_outs_phone ON drip_opt_outs(phone);
CREATE INDEX IF NOT EXISTS idx_drip_campaign_steps_campaign ON drip_campaign_steps(campaign_id);
CREATE INDEX IF NOT EXISTS idx_drip_fub_notes_contact ON drip_fub_notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_drip_fub_events_contact ON drip_fub_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_drip_fub_events_occurred ON drip_fub_events(occurred_at DESC);

-- RLS: server uses service role (bypasses RLS). Anon policies support any client-side reads if added later.
ALTER TABLE drip_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_opt_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_fub_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_fub_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_template_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon" ON drip_contacts;
DROP POLICY IF EXISTS "Allow all for anon" ON drip_campaigns;
DROP POLICY IF EXISTS "Allow all for anon" ON drip_campaign_steps;
DROP POLICY IF EXISTS "Allow all for anon" ON drip_enrollments;
DROP POLICY IF EXISTS "Allow all for anon" ON drip_messages;
DROP POLICY IF EXISTS "Allow all for anon" ON drip_opt_outs;
DROP POLICY IF EXISTS "Allow all for anon" ON drip_sync_log;
DROP POLICY IF EXISTS "Allow all for anon" ON drip_fub_notes;
DROP POLICY IF EXISTS "Allow all for anon" ON drip_fub_events;
DROP POLICY IF EXISTS "Allow all for anon" ON drip_template_folders;
DROP POLICY IF EXISTS "Allow all for anon" ON drip_message_templates;

CREATE POLICY "Allow all for anon" ON drip_contacts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON drip_campaigns FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON drip_campaign_steps FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON drip_enrollments FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON drip_messages FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON drip_opt_outs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON drip_sync_log FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON drip_fub_notes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON drip_fub_events FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON drip_template_folders FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON drip_message_templates FOR ALL TO anon USING (true) WITH CHECK (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_drip_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS drip_contacts_updated_at ON drip_contacts;
DROP TRIGGER IF EXISTS drip_campaigns_updated_at ON drip_campaigns;

CREATE TRIGGER drip_contacts_updated_at
  BEFORE UPDATE ON drip_contacts
  FOR EACH ROW EXECUTE FUNCTION update_drip_updated_at();

CREATE TRIGGER drip_campaigns_updated_at
  BEFORE UPDATE ON drip_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_drip_updated_at();

DROP TRIGGER IF EXISTS drip_message_templates_updated_at ON drip_message_templates;

CREATE TRIGGER drip_message_templates_updated_at
  BEFORE UPDATE ON drip_message_templates
  FOR EACH ROW EXECUTE FUNCTION update_drip_updated_at();

DROP TRIGGER IF EXISTS drip_template_folders_updated_at ON drip_template_folders;

CREATE TRIGGER drip_template_folders_updated_at
  BEFORE UPDATE ON drip_template_folders
  FOR EACH ROW EXECUTE FUNCTION update_drip_updated_at();

-- Safe if table already existed without this column (re-run after initial migration)
ALTER TABLE drip_campaigns ADD COLUMN IF NOT EXISTS twilio_from_number TEXT;
