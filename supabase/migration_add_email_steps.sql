-- Email drip steps: subject line + step_type 'email' (run after prior migrations)

ALTER TABLE drip_campaign_steps
  ADD COLUMN IF NOT EXISTS email_subject_template TEXT NOT NULL DEFAULT '';

ALTER TABLE drip_campaign_steps DROP CONSTRAINT IF EXISTS drip_campaign_steps_step_type_check;

ALTER TABLE drip_campaign_steps
  ADD CONSTRAINT drip_campaign_steps_step_type_check
  CHECK (step_type IN ('sms', 'email', 'fub_task'));
