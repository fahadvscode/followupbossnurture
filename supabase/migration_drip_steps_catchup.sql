-- Run this ONCE in Supabase SQL Editor if seed or the app fails on missing columns
-- (e.g. email_subject_template, step_type, fub_task_*, fub_action_plan_id).
-- Safe to re-run: uses IF NOT EXISTS and replaces the step_type check constraint.

-- Task / step-type columns (from migration_add_fub_task_steps.sql)
ALTER TABLE drip_campaign_steps
  ADD COLUMN IF NOT EXISTS step_type TEXT NOT NULL DEFAULT 'sms';

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

-- Email columns (from migration_add_email_steps.sql)
ALTER TABLE drip_campaign_steps
  ADD COLUMN IF NOT EXISTS email_subject_template TEXT NOT NULL DEFAULT '';

-- Action plan column (from migration_add_fub_action_plan_steps.sql)
ALTER TABLE drip_campaign_steps
  ADD COLUMN IF NOT EXISTS fub_action_plan_id INTEGER;

-- Minute-level delays (from migration_add_delay_minutes.sql)
ALTER TABLE drip_campaign_steps
  ADD COLUMN IF NOT EXISTS delay_minutes INTEGER NOT NULL DEFAULT 0;

-- HTML vs plain email body (from migration_drip_message_templates.sql)
ALTER TABLE drip_campaign_steps
  ADD COLUMN IF NOT EXISTS email_body_format TEXT NOT NULL DEFAULT 'plain';

ALTER TABLE drip_campaign_steps DROP CONSTRAINT IF EXISTS drip_campaign_steps_email_body_format_check;

ALTER TABLE drip_campaign_steps
  ADD CONSTRAINT drip_campaign_steps_email_body_format_check
  CHECK (email_body_format IN ('plain', 'html'));

-- Single canonical check: all step types the app uses
ALTER TABLE drip_campaign_steps DROP CONSTRAINT IF EXISTS drip_campaign_steps_step_type_check;

ALTER TABLE drip_campaign_steps
  ADD CONSTRAINT drip_campaign_steps_step_type_check
  CHECK (step_type IN ('sms', 'email', 'fub_action_plan', 'fub_task'));
