-- FUB task steps on drip_campaign_steps (run on existing DBs)

ALTER TABLE drip_campaign_steps
  ADD COLUMN IF NOT EXISTS step_type TEXT NOT NULL DEFAULT 'sms'
    CHECK (step_type IN ('sms', 'fub_task'));

ALTER TABLE drip_campaign_steps
  ADD COLUMN IF NOT EXISTS fub_task_type TEXT NOT NULL DEFAULT 'Call';

ALTER TABLE drip_campaign_steps
  ADD COLUMN IF NOT EXISTS fub_task_name_template TEXT NOT NULL DEFAULT '';

ALTER TABLE drip_campaign_steps
  ADD COLUMN IF NOT EXISTS fub_due_offset_minutes INTEGER NOT NULL DEFAULT 0;

ALTER TABLE drip_campaign_steps
  ADD COLUMN IF NOT EXISTS fub_assigned_user_id INTEGER;

ALTER TABLE drip_campaign_steps
  ADD COLUMN IF NOT EXISTS fub_remind_seconds_before INTEGER;
