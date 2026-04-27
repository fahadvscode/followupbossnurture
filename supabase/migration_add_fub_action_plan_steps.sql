-- FUB action plan steps (run on existing DBs after prior migrations)

ALTER TABLE drip_campaign_steps
  ADD COLUMN IF NOT EXISTS fub_action_plan_id INTEGER;

ALTER TABLE drip_campaign_steps DROP CONSTRAINT IF EXISTS drip_campaign_steps_step_type_check;

ALTER TABLE drip_campaign_steps
  ADD CONSTRAINT drip_campaign_steps_step_type_check
  CHECK (step_type IN ('sms', 'email', 'fub_action_plan', 'fub_task'));
