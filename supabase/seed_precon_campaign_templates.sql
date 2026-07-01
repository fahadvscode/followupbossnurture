-- Pre-construction Facebook lead templates (Fahad Javed multi-project system).
-- Run after migration_drip_steps_catchup.sql. Safe to re-run (skips if name exists).
--
-- Templates:
--   Pre-Con — 7-Day Fast Start       tag: precon-7-day-fast-start
--   Pre-Con — 14-Day Warm-Up         tag: precon-14-day-warm-up
--   Pre-Con — Monthly Keep-in-Touch  tag: precon-monthly-keep-in-touch
--
-- Merge fields: {first_name} {project} {city} {qikfill_link} {agent_phone}
-- Set QIKFILL_LINK (or BOOKING_LINK) and AGENT_PHONE in env for sends.

-- ═══════════════════════════════════════════════════════════════════
-- Pre-Con — 7-Day Fast Start
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE cid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM drip_campaigns WHERE name = 'Pre-Con — 7-Day Fast Start') THEN
    RAISE NOTICE 'Pre-Con 7-Day Fast Start already exists — skipping.';
  ELSE
    INSERT INTO drip_campaigns (name, description, trigger_tags, trigger_sources, status, twilio_from_number)
    VALUES (
      'Pre-Con — 7-Day Fast Start',
      'Facebook pre-con leads: instant text+email, 4 ISA calls, compare-all-projects angle. Book 15-min call in 7 days. Paused. Tag: precon-7-day-fast-start.',
      ARRAY['precon-7-day-fast-start']::text[], ARRAY[]::text[], 'paused', NULL
    ) RETURNING id INTO cid;

    INSERT INTO drip_campaign_steps (
      campaign_id, step_number, delay_days, delay_hours, delay_minutes,
      message_template, email_subject_template, email_body_format, step_type,
      fub_task_type, fub_task_name_template, fub_due_offset_minutes,
      fub_action_plan_id, fub_remind_seconds_before
    ) VALUES
    (cid, 1, 0, 0, 0,
      $m$Hi {first_name}, this is Fahad Javed 👋 Thanks for checking out {project} in {city}! I've got the prices and floor plans ready for you. Quick tip — there are a few other new projects in {city} too, and I'm happy to show you all of them so you can pick the best fit. I'll give you a quick call shortly, or just text me back anytime.$m$,
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 2, 0, 0, 2,
      $b$Hi {first_name},

Thanks so much for your interest in {project}! I've pulled together the prices, floor plans, and deposit details for you.

Here's something helpful to know: {project} isn't the only new project in {city} right now. There are a few others at different prices. Depending on what you're looking for, one of them might be an even better match.

Want me to show you all of them? It only takes about 15 minutes and there's no pressure at all. You can pick a time here: {qikfill_link}

A little about me: I help people buy new (pre-construction) homes across the GTA, and I get early access to the best units before they open to the public. So you'll see every option and get first pick.

Talk soon,
Fahad$b$,
      'Your {project} details (plus a few more {city} options)', 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 3, 0, 0, 5,
      '', '', 'plain', 'fub_task', 'Call',
      'Call #1 (within 5 min): {first_name} — {project} in {city}. Script: intro + Where/Budget/Why/Agent/Financing + book 15-min compare call.', 0, NULL, 300),
    (cid, 4, 0, 4, 0,
      '', '', 'plain', 'fub_task', 'Call',
      'Call #2 (different time of day): {first_name} — {project} in {city}. Voicemail if no answer.', 0, NULL, 900),
    (cid, 5, 1, 0, 0,
      $m$Hi {first_name}, it's Fahad. Would you like me to show you all the new {city} projects side by side — {project} and the others? I'll point out which ones have the best prices and easiest deposit plans right now. It's a quick 15-minute call. What day works best for you?$m$,
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 6, 2, 0, 0,
      $b$Hi {first_name},

Like I mentioned, here's a simple look at the new {city} projects right now, including {project}:

• Starting price — where each one begins, and which fits your budget.
• Deposit plan — how much you pay and when (some are much easier than others).
• Deals — things like free upgrades or capped fees — and which ones end soon.
• Move-in date — when each one is ready, which affects your planning.

The best choice really depends on your goals. It's a quick chat, not a long email — I can walk you through all of them in 15 minutes.

Grab a time and I'll show you all of them: {qikfill_link}

— Fahad$b$,
      '{city} new homes — a few projects compared for you', 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 7, 2, 0, 0,
      '', '', 'plain', 'fub_task', 'Call',
      'Call #3: {first_name} — follow up on comparison email for {city} projects.', 0, NULL, 900),
    (cid, 8, 3, 0, 0,
      $m$Hi {first_name}, just checking in — no rush at all. Whenever you're ready, I'm happy to walk you through the {city} projects and help you find the one that fits your budget best. If a quick call would help, you can grab a time here: {qikfill_link} — or just reply and we'll go at your pace.$m$,
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 9, 5, 0, 0,
      '', '', 'plain', 'fub_task', 'Call',
      $m$Call #4 (final friendly try): {first_name} — Just wanted to make sure you have what you need; I'm here whenever.$m$, 0, NULL, 900),
    (cid, 10, 6, 0, 0,
      $b$Hi {first_name},

I've reached out a few times and don't want to fill up your inbox. No worries at all if the timing isn't right — just reply with a 1, 2, or 3 and I'll take it from there:

1 — Still interested. I'll send you some times this week.
2 — Not right now, but keep me posted. I'll send a short {city} update once a month, no pressure.
3 — All set. No problem, I'll close things out.

Either way, I'm here whenever you need me. Thanks, {first_name}.

— Fahad$b$,
      'Should I keep helping with your {city} search?', 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 11, 6, 2, 0,
      '', '', 'plain', 'fub_task', 'Follow Up',
      'Handoff: {first_name} — no reply after 7-Day Fast Start → enroll in Pre-Con 14-Day Warm-Up.', 0, NULL, NULL);

    RAISE NOTICE 'Created Pre-Con 7-Day Fast Start: %', cid;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- Pre-Con — 14-Day Warm-Up
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE cid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM drip_campaigns WHERE name = 'Pre-Con — 14-Day Warm-Up') THEN
    RAISE NOTICE 'Pre-Con 14-Day Warm-Up already exists — skipping.';
  ELSE
    INSERT INTO drip_campaigns (name, description, trigger_tags, trigger_sources, status, twilio_from_number)
    VALUES (
      'Pre-Con — 14-Day Warm-Up',
      '7-Day non-responders or not-now leads. Value-first: 3 text, 2 call, 4 email over 14 days. Paused. Tag: precon-14-day-warm-up.',
      ARRAY['precon-14-day-warm-up']::text[], ARRAY[]::text[], 'paused', NULL
    ) RETURNING id INTO cid;

    INSERT INTO drip_campaign_steps (
      campaign_id, step_number, delay_days, delay_hours, delay_minutes,
      message_template, email_subject_template, email_body_format, step_type,
      fub_task_type, fub_task_name_template, fub_due_offset_minutes,
      fub_action_plan_id, fub_remind_seconds_before
    ) VALUES
    (cid, 1, 1, 0, 0,
      $b$Hi {first_name}, no pitch here — just a quick, honest read. Right now, builders in {city} are offering easier deposit plans and capped fees on their new projects, which is nice for buyers. Whenever you're ready — this month or next year — I'll happily show you which ones have the best terms. Truly no rush; I'm just here to help when it's the right time for you. — Fahad$b$,
      'An honest take on buying new in {city} right now', 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 2, 1, 4, 0,
      $m$Hi {first_name}, no rush at all — just checking in on {project}. Are you still thinking about {city}, or has your timing changed? Happy to keep you posted either way. — Fahad$m$,
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 3, 3, 0, 0,
      $b$Hi {first_name},

The two things people worry about most with new homes are the deposit and "what if my life changes before it's built." Good news — both are easier than they seem. Most projects let you pay the deposit in small pieces over 1–2 years, and you can usually sell your contract before it's finished if you ever need to. I can explain it all in about 10 minutes, no obligation.

Book a no-pressure chat: {qikfill_link}

— Fahad$b$,
      'How deposits and pre-construction really work (in plain words)', 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 4, 4, 0, 0,
      '', '', 'plain', 'fub_task', 'Call',
      'Warm call: {first_name} — Just making sure your questions about {project} got answered.', 0, NULL, 900),
    (cid, 5, 6, 0, 0,
      $m$Hi {first_name}, I pulled a floor plan / unit option for {project} that might fit what you were looking at in {city}. Want me to send it over? — Fahad$m$,
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 6, 8, 0, 0,
      $b$Hi {first_name},

Quick story — a buyer I worked with last month was set on one {city} project, but after comparing a few options side by side, they found a better deposit plan and saved on closing costs elsewhere. Same timeline, less stress.

If you'd like, I can do the same comparison for you — 15 minutes, no pressure: {qikfill_link}

— Fahad$b$,
      'How another {city} buyer found the right project', 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 7, 10, 0, 0,
      '', '', 'plain', 'fub_task', 'Call',
      'Call #2: {first_name} — fresh reason (new deal or unit on {project} / {city}).', 0, NULL, 900),
    (cid, 8, 12, 0, 0,
      $m$Hi {first_name}, just so you have it — there's a nice deal on one of the {city} projects right now. No pressure at all, but if you'd like me to check whether it fits what you're after, I'm glad to. I'm here whenever you need me: {qikfill_link}$m$,
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 9, 13, 0, 0,
      $b$Hi {first_name},

I'll keep this short — would you like me to send a monthly {city} new-home update (new projects, prices, deals)? No calls unless you ask. Just reply YES to stay on the list, or NO and I'll step back.

Thanks,
Fahad$b$,
      'Want to stay on my {city} update list?', 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 10, 13, 4, 0,
      '', '', 'plain', 'fub_task', 'Follow Up',
      'Handoff: {first_name} — 14-Day Warm-Up complete → enroll in Pre-Con Monthly Keep-in-Touch.', 0, NULL, NULL);

    RAISE NOTICE 'Created Pre-Con 14-Day Warm-Up: %', cid;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- Pre-Con — Monthly Keep-in-Touch
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE cid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM drip_campaigns WHERE name = 'Pre-Con — Monthly Keep-in-Touch') THEN
    RAISE NOTICE 'Pre-Con Monthly Keep-in-Touch already exists — skipping.';
  ELSE
    INSERT INTO drip_campaigns (name, description, trigger_tags, trigger_sources, status, twilio_from_number)
    VALUES (
      'Pre-Con — Monthly Keep-in-Touch',
      'Long-term nurture: monthly email + text, quarterly call. Future buyers. Paused. Tag: precon-monthly-keep-in-touch.',
      ARRAY['precon-monthly-keep-in-touch']::text[], ARRAY[]::text[], 'paused', NULL
    ) RETURNING id INTO cid;

    INSERT INTO drip_campaign_steps (
      campaign_id, step_number, delay_days, delay_hours, delay_minutes,
      message_template, email_subject_template, email_body_format, step_type,
      fub_task_type, fub_task_name_template, fub_due_offset_minutes,
      fub_action_plan_id, fub_remind_seconds_before
    ) VALUES
    (cid, 1, 1, 0, 0,
      $b$Hi {first_name},

Here's your quick 60-second {city} update: which projects just launched, how prices are moving, and which deals are new or ending soon. No pitch — just keeping you in the loop so you're ready whenever your timing lands. If anything looks interesting, just reply "tell me more."

— Fahad$b$,
      $s$What's new with {city} new homes this month$s$, 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 2, 7, 0, 0,
      $m$Hi {first_name}, a new {city} project just opened for early sign-ups (before it goes public). Thought of you since you'd looked at {project}. Want the prices and floor plans? Just reply "yes" and I'll send them over. — Fahad$m$,
      '', 'plain', 'sms', 'Call', '', 0, NULL, NULL),
    (cid, 3, 14, 0, 0,
      $b$Hi {first_name},

A quick how-to this month — three things buyers ask me most about new homes in {city}:

• Closing costs — what's typical and what builders sometimes cover.
• Rebates & incentives — how to tell a real deal from marketing fluff.
• Investor basics — deposit structure and assignment rules in plain English.

Reply anytime if you want me to walk through any of it on a quick call.

— Fahad$b$,
      'Pre-con basics: closing costs, rebates & investor tips', 'plain', 'email', 'Call', '', 0, NULL, NULL),
    (cid, 4, 90, 0, 0,
      '', '', 'plain', 'fub_task', 'Call',
      'Quarterly check-in: {first_name} — still on your radar for {city}? Re-enroll in 7-Day if ready.', 0, NULL, 900);

    RAISE NOTICE 'Created Pre-Con Monthly Keep-in-Touch: %', cid;
  END IF;
END $$;
