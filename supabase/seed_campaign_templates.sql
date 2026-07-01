-- Prebuilt drip campaign templates (all created PAUSED, one trigger tag each).
-- Mirrors the in-app "Start from a template" picker (src/lib/campaign-templates.ts).
--
-- Templates included:
--   1. Speed-to-Lead (Quick Response)       tag: speed-to-lead
--   2. Short-Term — 7-Day ISA Blitz         tag: isa-7-day-drip
--   3. Mid-Term — 30-Day Nurture            tag: nurture-30-day
--   4. Long-Term — 90-Day Nurture           tag: nurture-90-day
--   5. Open-House Follow-Up                 tag: open-house-follow-up
--   6. Past-Client / Sphere                 tag: past-client-sphere
--   7. Cold-Lead Re-Engagement              tag: cold-lead-reengagement
--
-- Delays are measured from ENROLLMENT time (not from the previous step).
-- FUB call/follow-up tasks include reminders via fub_remind_seconds_before.
--
-- PREREQUISITE: if you get "column does not exist", run first:
--   supabase/migration_drip_steps_catchup.sql
--
-- Safe to re-run: each block skips if a campaign with that name already exists.
-- After running: Edit each campaign → pick a Twilio "from" number for SMS → set the
-- trigger tag/groups you want → Activate.

-- ═══════════════════════════════════════════════════════════════════
-- 1. Speed-to-Lead (Quick Response)
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE cid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM drip_campaigns WHERE name = 'Speed-to-Lead (Quick Response)') THEN
    RAISE NOTICE 'Speed-to-Lead already exists — skipping.';
  ELSE
    INSERT INTO drip_campaigns (name, description, trigger_tags, trigger_sources, status, twilio_from_number)
    VALUES (
      'Speed-to-Lead (Quick Response)',
      'Instant same-day blitz for brand-new leads: text in seconds, call within 5 minutes, email at 30 minutes, second call same day. Paused until configured. Trigger tag: speed-to-lead.',
      ARRAY['speed-to-lead']::text[], ARRAY[]::text[], 'paused', NULL
    ) RETURNING id INTO cid;

    INSERT INTO drip_campaign_steps (
      campaign_id, step_number, delay_days, delay_hours, delay_minutes,
      message_template, email_subject_template, email_body_format, step_type,
      fub_task_type, fub_task_name_template, fub_due_offset_minutes,
      fub_action_plan_id, fub_remind_seconds_before
    ) VALUES
    (cid, 1, 0, 0, 0,
      'Hi {first_name}, thanks for reaching out about {project}! This is your agent — are you looking to buy, sell, or invest? Happy to help right away.',
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 2, 0, 0, 5,
      '', '', 'plain', 'fub_task', 'Call',
      'Speed-to-lead call: {first_name} about {project} (call within 5 min!)', 0, NULL, 300),
    (cid, 3, 0, 0, 30,
      $b$Hi {first_name},

Thanks again for your interest in {project}. Here's what I can send over right away:

• Current pricing and available incentives
• Floor plans and inventory
• Neighborhood and community details

What's the best number and time to reach you? Just reply here or text me anytime.

Talk soon!$b$,
      '{first_name}, here are the details on {project}', 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 4, 0, 3, 0,
      '', '', 'plain', 'fub_task', 'Call',
      '2nd call attempt: {first_name} ({project}) — different time of day', 0, NULL, 900),
    (cid, 5, 0, 6, 0,
      'Hi {first_name}, just following up on {project}. I have current pricing and floor plans ready — want me to send them over?',
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL);

    RAISE NOTICE 'Created Speed-to-Lead: %', cid;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Short-Term — 7-Day ISA Blitz
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE cid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM drip_campaigns WHERE name = 'Short-Term — 7-Day ISA Blitz') THEN
    RAISE NOTICE '7-Day ISA Blitz already exists — skipping.';
  ELSE
    INSERT INTO drip_campaigns (name, description, trigger_tags, trigger_sources, status, twilio_from_number)
    VALUES (
      'Short-Term — 7-Day ISA Blitz',
      '10 touches over 7 days: 3x text, 4x call tasks, 2x email, 1x nurture handoff. Proven ISA cadence. Paused until configured. Trigger tag: isa-7-day-drip.',
      ARRAY['isa-7-day-drip']::text[], ARRAY[]::text[], 'paused', NULL
    ) RETURNING id INTO cid;

    INSERT INTO drip_campaign_steps (
      campaign_id, step_number, delay_days, delay_hours, delay_minutes,
      message_template, email_subject_template, email_body_format, step_type,
      fub_task_type, fub_task_name_template, fub_due_offset_minutes,
      fub_action_plan_id, fub_remind_seconds_before
    ) VALUES
    (cid, 1, 0, 0, 0,
      'Hi {first_name}, thanks for interest in {project}! Quick Q — live-in or invest? I have early access pricing.',
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 2, 0, 0, 5,
      '', '', 'plain', 'fub_task', 'Call',
      'First call attempt + voicemail: {first_name} — "I have exclusive pricing + floor plans, call back or reply!"', 0, NULL, 300),
    (cid, 3, 0, 0, 30,
      $b$Hi {first_name},

Here's the exclusive info you requested on {project}.

• Early access pricing & current incentives
• Available floor plans & lot inventory
• Community highlights & neighborhood details

This is moving quickly — happy to walk you through everything whenever it's convenient. Just reply to this email or give me a call.

Looking forward to connecting!$b$,
      $s$Here's the exclusive info you requested on {project}$s$, 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 4, 1, 0, 0,
      '', '', 'plain', 'fub_task', 'Call',
      '2nd call: {first_name} ({project}). Different time of day. No voicemail.', 0, NULL, 900),
    (cid, 5, 1, 0, 0,
      'Hey {first_name}, tried calling about {project}. Floor plans going fast — want me to send?',
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 6, 3, 0, 0,
      '', '', 'plain', 'fub_task', 'Call',
      '3rd call: {first_name} ({project}). Try morning if previous were afternoon.', 0, NULL, 900),
    (cid, 7, 3, 0, 0,
      $b$Hi {first_name},

Quick update — the builder just released new incentives for {project}. Worth a look while they last.

Want me to send the updated pricing sheet? Just reply and I'll get it right over.$b$,
      'Quick update — builder released new incentives for {project}', 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 8, 6, 0, 0,
      $m$Closing the loop on {project}, {first_name}. Not the right time? No problem — I'll keep you posted on new releases.$m$,
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 9, 6, 0, 0,
      '', '', 'plain', 'fub_task', 'Call',
      'Final call: {first_name}. No answer → move to Nurture in FUB.', 0, NULL, 900),
    (cid, 10, 13, 0, 0,
      '', '', 'plain', 'fub_task', 'Follow Up',
      'Nurture handoff: {first_name} enters monthly nurture cadence. No more manual ISA outreach.', 0, NULL, NULL);

    RAISE NOTICE 'Created 7-Day ISA Blitz: %', cid;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Mid-Term — 30-Day Nurture
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE cid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM drip_campaigns WHERE name = 'Mid-Term — 30-Day Nurture') THEN
    RAISE NOTICE '30-Day Nurture already exists — skipping.';
  ELSE
    INSERT INTO drip_campaigns (name, description, trigger_tags, trigger_sources, status, twilio_from_number)
    VALUES (
      'Mid-Term — 30-Day Nurture',
      '8 touches across 30 days: alternating SMS/email value drops with periodic call tasks and reminders. Paused until configured. Trigger tag: nurture-30-day.',
      ARRAY['nurture-30-day']::text[], ARRAY[]::text[], 'paused', NULL
    ) RETURNING id INTO cid;

    INSERT INTO drip_campaign_steps (
      campaign_id, step_number, delay_days, delay_hours, delay_minutes,
      message_template, email_subject_template, email_body_format, step_type,
      fub_task_type, fub_task_name_template, fub_due_offset_minutes,
      fub_action_plan_id, fub_remind_seconds_before
    ) VALUES
    (cid, 1, 1, 0, 0,
      $m$Hi {first_name}, checking in on {project}. No rush at all — I'm here whenever you're ready. Any questions I can answer?$m$,
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 2, 4, 0, 0,
      $b$Hi {first_name},

While you're thinking about {project}, here are a few things buyers ask me most:

• How pricing and incentives are trending
• What's still available (and what's selling fast)
• Deposit structure and timelines

Happy to walk through any of it. Just reply and let me know what's most useful.$b$,
      '{first_name}, a few things to know about {project}', 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 3, 8, 0, 0,
      '', '', 'plain', 'fub_task', 'Call',
      'Check-in call: {first_name} about {project} (week 1 nurture)', 0, NULL, 900),
    (cid, 4, 12, 0, 0,
      'Hey {first_name}, thought of you — new inventory/pricing update on {project}. Want the latest details?',
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 5, 18, 0, 0,
      $b$Hi {first_name},

Markets and incentives shift month to month, so I wanted to check in on {project}.

If your timeline has changed — sooner or later — just let me know and I'll tailor what I send you. No pressure either way.$b$,
      'Is now a good time for {project}, {first_name}?', 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 6, 22, 0, 0,
      '', '', 'plain', 'fub_task', 'Call',
      'Value call: {first_name} ({project}) — share latest incentives', 0, NULL, 900),
    (cid, 7, 26, 0, 0,
      $m$Hi {first_name}, still happy to help with {project} whenever you're ready. Want me to keep you on the update list?$m$,
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 8, 30, 0, 0,
      $b$Hi {first_name},

I'll keep sending occasional updates on {project} so you're always in the loop. If anything changes on your end, I'm one reply away.

Talk soon!$b$,
      'Keeping in touch on {project}', 'plain', 'email', 'Call', '', 0, NULL, NULL);

    RAISE NOTICE 'Created 30-Day Nurture: %', cid;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 4. Long-Term — 90-Day Nurture
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE cid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM drip_campaigns WHERE name = 'Long-Term — 90-Day Nurture') THEN
    RAISE NOTICE '90-Day Nurture already exists — skipping.';
  ELSE
    INSERT INTO drip_campaigns (name, description, trigger_tags, trigger_sources, status, twilio_from_number)
    VALUES (
      'Long-Term — 90-Day Nurture',
      '7 light touches across 90 days (roughly every 2 weeks): low-pressure SMS/email check-ins plus a monthly call task. Paused until configured. Trigger tag: nurture-90-day.',
      ARRAY['nurture-90-day']::text[], ARRAY[]::text[], 'paused', NULL
    ) RETURNING id INTO cid;

    INSERT INTO drip_campaign_steps (
      campaign_id, step_number, delay_days, delay_hours, delay_minutes,
      message_template, email_subject_template, email_body_format, step_type,
      fub_task_type, fub_task_name_template, fub_due_offset_minutes,
      fub_action_plan_id, fub_remind_seconds_before
    ) VALUES
    (cid, 1, 1, 0, 0,
      $m$Hi {first_name}, no rush on {project} — I'll check in now and then with anything useful. Reply anytime if your plans change.$m$,
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 2, 15, 0, 0,
      $b$Hi {first_name},

Just a light check-in on {project}. Here's what's new:

• Latest pricing and incentives
• What's currently available

No action needed — just keeping you informed. Reply anytime if you'd like more detail.$b$,
      '{first_name}, a quick {project} update', 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 3, 30, 0, 0,
      'Hi {first_name}, thinking of you — anything change with your {project} timeline? Happy to help whenever the time is right.',
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 4, 45, 0, 0,
      '', '', 'plain', 'fub_task', 'Call',
      'Monthly nurture call: {first_name} about {project}', 0, NULL, 900),
    (cid, 5, 60, 0, 0,
      $b$Hi {first_name},

Markets move, so here's a fresh look at {project}:

• Updated pricing / incentives
• New availability

If your timeline is getting closer, let's talk. If not, I'll keep the updates coming.$b$,
      'Still here for you on {project}, {first_name}', 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 6, 75, 0, 0,
      'Hey {first_name}, quick check-in on {project}. Want me to keep sending updates, or pause for now? Totally your call.',
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 7, 90, 0, 0,
      '', '', 'plain', 'fub_task', 'Follow Up',
      'Quarterly review: {first_name} ({project}) — reassess timeline and re-engage', 0, NULL, 900);

    RAISE NOTICE 'Created 90-Day Nurture: %', cid;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 5. Open-House Follow-Up
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE cid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM drip_campaigns WHERE name = 'Open-House Follow-Up') THEN
    RAISE NOTICE 'Open-House Follow-Up already exists — skipping.';
  ELSE
    INSERT INTO drip_campaigns (name, description, trigger_tags, trigger_sources, status, twilio_from_number)
    VALUES (
      'Open-House Follow-Up',
      'Days 0-10 after an open house: thank-you text, next-day call, day-2 email with similar listings, day-5 text, day-10 call. Paused until configured. Trigger tag: open-house-follow-up.',
      ARRAY['open-house-follow-up']::text[], ARRAY[]::text[], 'paused', NULL
    ) RETURNING id INTO cid;

    INSERT INTO drip_campaign_steps (
      campaign_id, step_number, delay_days, delay_hours, delay_minutes,
      message_template, email_subject_template, email_body_format, step_type,
      fub_task_type, fub_task_name_template, fub_due_offset_minutes,
      fub_action_plan_id, fub_remind_seconds_before
    ) VALUES
    (cid, 1, 0, 0, 0,
      'Hi {first_name}, great to meet you at the {project} open house! Thanks for stopping by. Any questions come to mind after seeing it?',
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 2, 1, 0, 0,
      '', '', 'plain', 'fub_task', 'Call',
      'Open house follow-up call: {first_name} ({project})', 0, NULL, 900),
    (cid, 3, 2, 0, 0,
      $b$Hi {first_name},

Great meeting you at the {project} open house! Based on what you liked, here are a few similar options worth a look.

Want me to put together a personalized list or set up private showings? Just reply and I'll get started.

Thanks again for coming by!$b$,
      '{first_name}, homes like {project} you may love', 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 4, 5, 0, 0,
      'Hi {first_name}, still thinking about {project}? Happy to answer questions or line up a few similar homes to see.',
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 5, 10, 0, 0,
      '', '', 'plain', 'fub_task', 'Call',
      'Final open-house follow-up: {first_name} ({project}) — gauge interest, add to nurture if cold', 0, NULL, 900);

    RAISE NOTICE 'Created Open-House Follow-Up: %', cid;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 6. Past-Client / Sphere
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE cid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM drip_campaigns WHERE name = 'Past-Client / Sphere') THEN
    RAISE NOTICE 'Past-Client / Sphere already exists — skipping.';
  ELSE
    INSERT INTO drip_campaigns (name, description, trigger_tags, trigger_sources, status, twilio_from_number)
    VALUES (
      'Past-Client / Sphere',
      'Quarterly stay-in-touch for past clients and sphere (days 1, 90, 180, 270, 365): friendly check-ins plus an annual home-review call. Paused until configured. Trigger tag: past-client-sphere.',
      ARRAY['past-client-sphere']::text[], ARRAY[]::text[], 'paused', NULL
    ) RETURNING id INTO cid;

    INSERT INTO drip_campaign_steps (
      campaign_id, step_number, delay_days, delay_hours, delay_minutes,
      message_template, email_subject_template, email_body_format, step_type,
      fub_task_type, fub_task_name_template, fub_due_offset_minutes,
      fub_action_plan_id, fub_remind_seconds_before
    ) VALUES
    (cid, 1, 1, 0, 0,
      $m$Hi {first_name}! Just checking in — hope you're doing great. Anything I can help with, or anyone you know who needs a hand with real estate?$m$,
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 2, 90, 0, 0,
      $b$Hi {first_name},

Hope all is well! Just staying in touch. If you ever have questions about your home's value, the market, or a friend who needs an agent, I'm always here.

Always happy to help — no strings attached.$b$,
      'Checking in, {first_name}', 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 3, 180, 0, 0,
      'Hi {first_name}, thinking of you! Curious what your home might be worth today? Happy to send a quick estimate anytime.',
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 4, 270, 0, 0,
      $b$Hi {first_name},

Just a friendly hello and a reminder that I'm here whenever you need real estate advice — for you or anyone you'd refer.

Wishing you all the best!$b$,
      'A quick hello, {first_name}', 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 5, 365, 0, 0,
      '', '', 'plain', 'fub_task', 'Call',
      'Annual home review call: {first_name} — equity update + referral ask', 0, NULL, 900);

    RAISE NOTICE 'Created Past-Client / Sphere: %', cid;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 7. Cold-Lead Re-Engagement
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE cid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM drip_campaigns WHERE name = 'Cold-Lead Re-Engagement') THEN
    RAISE NOTICE 'Cold-Lead Re-Engagement already exists — skipping.';
  ELSE
    INSERT INTO drip_campaigns (name, description, trigger_tags, trigger_sources, status, twilio_from_number)
    VALUES (
      'Cold-Lead Re-Engagement',
      'Days 1-21 to win back quiet leads: re-intro text, day-3 email, day-7 call, day-14 breakup text, day-21 nurture handoff. Paused until configured. Trigger tag: cold-lead-reengagement.',
      ARRAY['cold-lead-reengagement']::text[], ARRAY[]::text[], 'paused', NULL
    ) RETURNING id INTO cid;

    INSERT INTO drip_campaign_steps (
      campaign_id, step_number, delay_days, delay_hours, delay_minutes,
      message_template, email_subject_template, email_body_format, step_type,
      fub_task_type, fub_task_name_template, fub_due_offset_minutes,
      fub_action_plan_id, fub_remind_seconds_before
    ) VALUES
    (cid, 1, 1, 0, 0,
      $m$Hi {first_name}, it's been a while! Still interested in {project} or something similar? Timelines change — happy to pick back up whenever.$m$,
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 2, 3, 0, 0,
      $b$Hi {first_name},

We connected a while back about {project} and I wanted to reach out again. A lot has changed — pricing, incentives, and availability.

If you're still exploring (even casually), reply and I'll send a quick update tailored to you. If now isn't the time, no worries at all.$b$,
      'Still thinking about {project}, {first_name}?', 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 3, 7, 0, 0,
      '', '', 'plain', 'fub_task', 'Call',
      'Re-engagement call: {first_name} ({project}) — is this still on their radar?', 0, NULL, 900),
    (cid, 4, 14, 0, 0,
      $m$Hi {first_name}, I don't want to crowd your inbox. Should I keep sending {project} updates, or pause for now? Just reply KEEP or PAUSE.$m$,
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 5, 21, 0, 0,
      '', '', 'plain', 'fub_task', 'Follow Up',
      'Nurture handoff: {first_name} — move to long-term list if still unresponsive', 0, NULL, NULL);

    RAISE NOTICE 'Created Cold-Lead Re-Engagement: %', cid;
  END IF;
END $$;
