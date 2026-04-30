-- Default AI follow-up spacing: 24h (one nudge per day when lead is silent)
ALTER TABLE drip_ai_campaign_config
  ALTER COLUMN follow_up_delay_minutes SET DEFAULT 1440;
