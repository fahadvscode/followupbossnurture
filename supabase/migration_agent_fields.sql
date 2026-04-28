-- Add per-campaign first message override and office address fields
-- first_message_override: if set, AI skips generation and sends this text as-is for message #1
-- office_address: real office address; baked into system prompt so AI never invents one

ALTER TABLE drip_ai_campaign_config
  ADD COLUMN IF NOT EXISTS first_message_override TEXT,
  ADD COLUMN IF NOT EXISTS office_address TEXT;
