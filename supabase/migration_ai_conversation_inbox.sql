-- Inbox: needs_attention flag + human_takeover status
-- Run in Supabase → SQL Editor

ALTER TABLE drip_ai_conversations
  ADD COLUMN IF NOT EXISTS needs_attention BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS takeover_at TIMESTAMPTZ;

-- Index for inbox queries
CREATE INDEX IF NOT EXISTS idx_ai_conv_needs_attention
  ON drip_ai_conversations (needs_attention, status, updated_at DESC);
