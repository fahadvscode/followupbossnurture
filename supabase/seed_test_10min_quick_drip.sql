-- Quick real-time test campaign: SMS → Email → FUB task → SMS over ~10 minutes (delays from enrollment).
-- Delays: 0m, 3m, 6m, 10m after enroll. Run drip runner often (e.g. every 1–2 min in dev).
--
-- Before testing:
--   1. Run in Supabase SQL Editor (safe to re-run; skips if campaign name exists).
--   2. In the app: Campaigns → open this campaign → pick Twilio "from" for SMS steps.
--   3. Contact needs phone (SMS), email (email step), fub_id + assignee env (FUB task step).
--   4. Set FUB_DEFAULT_TASK_ASSIGNED_USER_ID (or step assignee) for tasks.
--   5. Enroll a test lead, then use "Run due drip sends now" or cron frequently.
--
-- To remove later: delete the campaign in the UI or: DELETE FROM drip_campaigns WHERE name LIKE 'TEST — 10 min%';

DO $$
DECLARE
  cid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM drip_campaigns WHERE name = 'TEST — 10 min quick drip (SMS + Email + Task)') THEN
    RAISE NOTICE 'Test campaign already exists — skipping.';
    RETURN;
  END IF;

  INSERT INTO drip_campaigns (
    name,
    description,
    trigger_tags,
    trigger_sources,
    status,
    twilio_from_number
  )
  VALUES (
    'TEST — 10 min quick drip (SMS + Email + Task)',
    'DEV/QA only. Delays from enroll: 0m SMS, 3m email, 6m FUB task, 10m SMS. Hit /api/cron/send-drips every 1–2 min in dev. Pause or delete when done.',
    ARRAY['test-quick-drip']::text[],
    ARRAY[]::text[],
    'active',
    NULL
  )
  RETURNING id INTO cid;

  INSERT INTO drip_campaign_steps (
    campaign_id,
    step_number,
    delay_days,
    delay_hours,
    delay_minutes,
    message_template,
    email_subject_template,
    email_body_format,
    step_type,
    fub_task_type,
    fub_task_name_template,
    fub_due_offset_minutes,
    fub_action_plan_id,
    fub_assigned_user_id
  ) VALUES
  (
    cid,
    1,
    0,
    0,
    0,
    '[TEST 0m] Hi {first_name} — quick drip step 1 (SMS). Reply STOP to opt out.',
    '',
    'plain',
    'sms',
    'Call',
    '',
    0,
    NULL,
    NULL
  ),
  (
    cid,
    2,
    0,
    0,
    3,
    'Hi {first_name},\n\nThis is TEST step 2 (email) — ~3 minutes after enrollment.\n\n— Drip test',
    'TEST: quick drip step 2 (email)',
    'plain',
    'email',
    'Call',
    '',
    0,
    NULL,
    NULL
  ),
  (
    cid,
    3,
    0,
    0,
    6,
    '',
    '',
    'plain',
    'fub_task',
    'Call',
    '[TEST 6m] Quick drip — call {first_name} ({project})',
    15,
    NULL,
    NULL
  ),
  (
    cid,
    4,
    0,
    0,
    10,
    '[TEST 10m] Final ping — quick drip complete for {first_name}.',
    '',
    'plain',
    'sms',
    'Call',
    '',
    0,
    NULL,
    NULL
  );

  RAISE NOTICE 'Created test campaign id: %', cid;
END $$;
