-- Add persona_name to AI campaign config
ALTER TABLE drip_ai_campaign_config
  ADD COLUMN IF NOT EXISTS persona_name TEXT;
