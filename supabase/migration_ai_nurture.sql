-- AI Nurture Engine tables
-- Run in Supabase SQL Editor after all previous migrations.

-- 1. Extend drip_campaigns with campaign_type
ALTER TABLE drip_campaigns
  ADD COLUMN IF NOT EXISTS campaign_type TEXT NOT NULL DEFAULT 'standard'
  CHECK (campaign_type IN ('standard', 'ai_nurture'));

-- 2. AI campaign configuration (1:1 with drip_campaigns where campaign_type = 'ai_nurture')
CREATE TABLE IF NOT EXISTS drip_ai_campaign_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL UNIQUE REFERENCES drip_campaigns(id) ON DELETE CASCADE,
  goal TEXT NOT NULL DEFAULT 'book_call' CHECK (goal IN ('book_call', 'long_nurture', 'visit_site')),
  booking_url TEXT,
  landing_url TEXT,
  personality TEXT NOT NULL DEFAULT '',
  max_exchanges INTEGER NOT NULL DEFAULT 10,
  follow_up_delay_minutes INTEGER NOT NULL DEFAULT 120,
  max_follow_ups INTEGER NOT NULL DEFAULT 3,
  escalation_action TEXT NOT NULL DEFAULT 'both' CHECK (escalation_action IN ('pause', 'fub_task', 'both')),
  escalation_fub_user_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_config_campaign ON drip_ai_campaign_config(campaign_id);

-- 3. Knowledge documents (project info fed to AI)
CREATE TABLE IF NOT EXISTS drip_ai_knowledge_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES drip_campaigns(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL DEFAULT 'text' CHECK (doc_type IN ('text', 'file')),
  title TEXT NOT NULL DEFAULT '',
  content_text TEXT NOT NULL DEFAULT '',
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  extracted_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_docs_campaign ON drip_ai_knowledge_docs(campaign_id);

-- 4. Media assets for MMS (banners, flyers)
CREATE TABLE IF NOT EXISTS drip_ai_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES drip_campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  media_url TEXT NOT NULL,
  mime_type TEXT,
  send_with TEXT NOT NULL DEFAULT 'any' CHECK (send_with IN ('first', 'follow_up', 'any', 'manual')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_media_campaign ON drip_ai_media(campaign_id);

-- 5. Conversation state per enrollment
CREATE TABLE IF NOT EXISTS drip_ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL UNIQUE REFERENCES drip_enrollments(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES drip_contacts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES drip_campaigns(id) ON DELETE CASCADE,
  exchange_count INTEGER NOT NULL DEFAULT 0,
  follow_up_count INTEGER NOT NULL DEFAULT 0,
  last_outbound_at TIMESTAMPTZ,
  last_inbound_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'escalated', 'goal_met')),
  goal_met_at TIMESTAMPTZ,
  escalation_reason TEXT,
  conversation_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_enrollment ON drip_ai_conversations(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_contact ON drip_ai_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_campaign ON drip_ai_conversations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_status ON drip_ai_conversations(status);

-- RLS (service role bypasses; anon gets full access like other drip_ tables)
ALTER TABLE drip_ai_campaign_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_ai_knowledge_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_ai_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon" ON drip_ai_campaign_config;
DROP POLICY IF EXISTS "Allow all for anon" ON drip_ai_knowledge_docs;
DROP POLICY IF EXISTS "Allow all for anon" ON drip_ai_media;
DROP POLICY IF EXISTS "Allow all for anon" ON drip_ai_conversations;

CREATE POLICY "Allow all for anon" ON drip_ai_campaign_config FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON drip_ai_knowledge_docs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON drip_ai_media FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON drip_ai_conversations FOR ALL TO anon USING (true) WITH CHECK (true);

-- updated_at triggers
DROP TRIGGER IF EXISTS drip_ai_config_updated_at ON drip_ai_campaign_config;
CREATE TRIGGER drip_ai_config_updated_at
  BEFORE UPDATE ON drip_ai_campaign_config
  FOR EACH ROW EXECUTE FUNCTION update_drip_updated_at();

DROP TRIGGER IF EXISTS drip_ai_conv_updated_at ON drip_ai_conversations;
CREATE TRIGGER drip_ai_conv_updated_at
  BEFORE UPDATE ON drip_ai_conversations
  FOR EACH ROW EXECUTE FUNCTION update_drip_updated_at();
