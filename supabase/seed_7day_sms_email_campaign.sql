-- ISA New Lead Drip: 10-step, 7-day multi-channel cadence (paused).
-- Mirrors proven real estate ISA workflow: TEXT → CALL → EMAIL → CALL → TEXT → CALL → EMAIL → TEXT → CALL → NURTURE HANDOFF.
--
-- Delays are from ENROLLMENT time (not previous step).
--
-- PREREQUISITE: If you see "column does not exist", run first:
--   supabase/migration_drip_steps_catchup.sql
-- Optional: preload matching SMS library entries (Day 1 / 2 / 7) with seed_sms_templates_isa_days.sql
--
-- Run this in Supabase SQL Editor after drip_campaign_steps has all columns.
-- Then: Edit campaign → pick Twilio "from" for SMS → set SMTP / FUB email → Activate.
-- Trigger tag: new-lead-drip  (change in campaign settings if needed).

DO $$
DECLARE
  cid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM drip_campaigns WHERE name = 'ISA New Lead 7-Day Drip') THEN
    RAISE NOTICE 'Campaign already exists — skipping seed.';
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
    'ISA New Lead 7-Day Drip',
    '10 touches over 7 days: 3× Text, 4× Call tasks, 2× Email, 1× Nurture handoff. Proven ISA cadence. Paused until configured. Trigger tag: new-lead-drip.',
    ARRAY['new-lead-drip']::text[],
    ARRAY[]::text[],
    'paused',
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
    step_type,
    fub_task_type,
    fub_task_name_template,
    fub_due_offset_minutes,
    fub_action_plan_id
  ) VALUES

  -- ═══════════════════════════════════════════════════════════════════
  -- DAY 1 — Three rapid touches
  -- ═══════════════════════════════════════════════════════════════════

  -- Step 1 · Day 1, 0m · TEXT
  (
    cid, 1, 0, 0, 0,
    'Hi {first_name}, thanks for interest in {project}! Quick Q — live-in or invest? I have early access pricing.',
    '',
    'sms',
    'Call', '', 0, NULL
  ),

  -- Step 2 · Day 1, 5m · CALL
  (
    cid, 2, 0, 0, 5,
    '',
    '',
    'fub_task',
    'Call',
    'First call attempt + voicemail. "I have exclusive pricing + floor plans — call back or reply to text!"',
    0, NULL
  ),

  -- Step 3 · Day 1, 30m · EMAIL
  (
    cid, 3, 0, 0, 30,
    $b3$Hi {first_name},

Here''s the exclusive info you requested on {project}.

• Early access pricing & current incentives
• Available floor plans & lot inventory
• Community highlights & neighborhood details

This is moving quickly — happy to walk you through everything whenever it''s convenient. Just reply to this email or give me a call.

Looking forward to connecting!$b3$,
    'Here''s the exclusive info you requested on {project}',
    'email',
    'Call', '', 0, NULL
  ),

  -- ═══════════════════════════════════════════════════════════════════
  -- DAY 2 — Call + Text
  -- ═══════════════════════════════════════════════════════════════════

  -- Step 4 · Day 2 · CALL
  (
    cid, 4, 1, 0, 0,
    '',
    '',
    'fub_task',
    'Call',
    '2nd call. Different time of day. No voicemail.',
    0, NULL
  ),

  -- Step 5 · Day 2 · TEXT
  (
    cid, 5, 1, 0, 0,
    'Hey {first_name}, tried calling about {project}. Floor plans going fast — want me to send?',
    '',
    'sms',
    'Call', '', 0, NULL
  ),

  -- ═══════════════════════════════════════════════════════════════════
  -- DAY 4 — Call + Email
  -- ═══════════════════════════════════════════════════════════════════

  -- Step 6 · Day 4 · CALL
  (
    cid, 6, 3, 0, 0,
    '',
    '',
    'fub_task',
    'Call',
    '3rd call. Try morning if previous were afternoon.',
    0, NULL
  ),

  -- Step 7 · Day 4 · EMAIL
  (
    cid, 7, 3, 0, 0,
    'Quick update — builder released new incentives for {project}. Worth a look.',
    'Quick update — builder released new incentives for {project}',
    'email',
    'Call', '', 0, NULL
  ),

  -- ═══════════════════════════════════════════════════════════════════
  -- DAY 7 — Final text + final call
  -- ═══════════════════════════════════════════════════════════════════

  -- Step 8 · Day 7 · TEXT
  (
    cid, 8, 6, 0, 0,
    'Closing the loop on {project}. Not the right time? I''ll keep you posted.',
    '',
    'sms',
    'Call', '', 0, NULL
  ),

  -- Step 9 · Day 7 · CALL
  (
    cid, 9, 6, 0, 0,
    '',
    '',
    'fub_task',
    'Call',
    'Final call. No answer → Move to "Nurture" in FUB. Add to CC city list.',
    0, NULL
  ),

  -- ═══════════════════════════════════════════════════════════════════
  -- DAY 14+ — Nurture handoff
  -- ═══════════════════════════════════════════════════════════════════

  -- Step 10 · Day 14+ · AUTO
  (
    cid, 10, 13, 0, 0,
    '',
    '',
    'fub_task',
    'Follow Up',
    'Enters Constant Contact monthly cadence (6 emails/city). No more manual ISA outreach.',
    0, NULL
  );

END $$;
