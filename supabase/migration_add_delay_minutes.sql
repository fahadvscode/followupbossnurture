-- Adds minute-level delay precision to drip steps (run on existing DBs)
ALTER TABLE drip_campaign_steps
  ADD COLUMN IF NOT EXISTS delay_minutes INTEGER NOT NULL DEFAULT 0;
