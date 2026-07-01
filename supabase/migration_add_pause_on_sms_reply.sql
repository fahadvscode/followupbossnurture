-- Pause a lead's enrollment when they reply by SMS (per campaign, default on).
ALTER TABLE drip_campaigns
  ADD COLUMN IF NOT EXISTS pause_on_sms_reply BOOLEAN NOT NULL DEFAULT true;
