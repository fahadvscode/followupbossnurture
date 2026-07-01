import type { CampaignTemplate, TemplateStep } from './campaign-templates';

type StepInput = Partial<TemplateStep> & {
  step_number: number;
  step_type: TemplateStep['step_type'];
};

function step(input: StepInput): TemplateStep {
  return {
    step_number: input.step_number,
    delay_days: input.delay_days ?? 0,
    delay_hours: input.delay_hours ?? 0,
    delay_minutes: input.delay_minutes ?? 0,
    message_template: input.message_template ?? '',
    step_type: input.step_type,
    email_subject_template: input.email_subject_template ?? '',
    email_body_format: input.email_body_format ?? 'plain',
    fub_action_plan_id: input.fub_action_plan_id ?? '',
    fub_task_type: input.fub_task_type ?? 'Call',
    fub_task_name_template: input.fub_task_name_template ?? '',
    fub_due_offset_minutes: input.fub_due_offset_minutes ?? 0,
    fub_assigned_user_id: input.fub_assigned_user_id ?? '',
    fub_email_user_id: input.fub_email_user_id ?? '',
    fub_remind_seconds_before: input.fub_remind_seconds_before ?? '',
  };
}

/** Pre-construction Facebook lead system (Fahad Javed / multi-project angle). */
export const PRECON_CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'precon-7-day-fast-start',
    name: 'Pre-Con — 7-Day Fast Start',
    description:
      'Facebook pre-con leads: instant text + email, 4 ISA calls, compare-all-projects angle. Goal: book a 15-min call in 7 days. Hand off to 14-Day Warm-Up if no reply. Tag: precon-7-day-fast-start.',
    category: 'short',
    steps: [
      step({
        step_number: 1,
        step_type: 'sms',
        message_template:
          "Hi {first_name}, this is Fahad Javed 👋 Thanks for checking out {project} in {city}! I've got the prices and floor plans ready for you. Quick tip — there are a few other new projects in {city} too, and I'm happy to show you all of them so you can pick the best fit. I'll give you a quick call shortly, or just text me back anytime.",
      }),
      step({
        step_number: 2,
        step_type: 'email',
        delay_minutes: 2,
        email_subject_template: 'Your {project} details (plus a few more {city} options)',
        message_template:
          "Hi {first_name},\n\nThanks so much for your interest in {project}! I've pulled together the prices, floor plans, and deposit details for you.\n\nHere's something helpful to know: {project} isn't the only new project in {city} right now. There are a few others at different prices. Depending on what you're looking for, one of them might be an even better match.\n\nWant me to show you all of them? It only takes about 15 minutes and there's no pressure at all. You can pick a time here: {qikfill_link}\n\nA little about me: I help people buy new (pre-construction) homes across the GTA, and I get early access to the best units before they open to the public. So you'll see every option and get first pick.\n\nTalk soon,\nFahad",
      }),
      step({
        step_number: 3,
        step_type: 'fub_task',
        delay_minutes: 5,
        fub_task_type: 'Call',
        fub_task_name_template:
          'Call #1 (within 5 min): {first_name} — {project} in {city}. Script: intro + Where/Budget/Why/Agent/Financing + book 15-min compare call.',
        fub_remind_seconds_before: 300,
        message_template:
          'Voicemail if no answer: "Hi {first_name}, it\'s Fahad Javed with Century 21. You just signed up for {project} in {city}. I\'ve got the prices and floor plans ready, plus a few other {city} projects that might fit you even better. Give me a call or text back at {agent_phone} whenever you get a sec — happy to help. Thanks!"',
      }),
      step({
        step_number: 4,
        step_type: 'fub_task',
        delay_hours: 4,
        fub_task_type: 'Call',
        fub_task_name_template:
          'Call #2 (different time of day): {first_name} — {project} in {city}. Voicemail if no answer.',
        fub_remind_seconds_before: 900,
      }),
      step({
        step_number: 5,
        step_type: 'sms',
        delay_days: 1,
        message_template:
          "Hi {first_name}, it's Fahad. Would you like me to show you all the new {city} projects side by side — {project} and the others? I'll point out which ones have the best prices and easiest deposit plans right now. It's a quick 15-minute call. What day works best for you?",
      }),
      step({
        step_number: 6,
        step_type: 'email',
        delay_days: 2,
        email_subject_template: '{city} new homes — a few projects compared for you',
        message_template:
          "Hi {first_name},\n\nLike I mentioned, here's a simple look at the new {city} projects right now, including {project}:\n\n• Starting price — where each one begins, and which fits your budget.\n• Deposit plan — how much you pay and when (some are much easier than others).\n• Deals — things like free upgrades or capped fees — and which ones end soon.\n• Move-in date — when each one is ready, which affects your planning.\n\nThe best choice really depends on your goals. It's a quick chat, not a long email — I can walk you through all of them in 15 minutes.\n\nGrab a time and I'll show you all of them: {qikfill_link}\n\n— Fahad",
      }),
      step({
        step_number: 7,
        step_type: 'fub_task',
        delay_days: 2,
        fub_task_type: 'Call',
        fub_task_name_template:
          'Call #3: {first_name} — follow up on comparison email for {city} projects.',
        fub_remind_seconds_before: 900,
      }),
      step({
        step_number: 8,
        step_type: 'sms',
        delay_days: 3,
        message_template:
          "Hi {first_name}, just checking in — no rush at all. Whenever you're ready, I'm happy to walk you through the {city} projects and help you find the one that fits your budget best. If a quick call would help, you can grab a time here: {qikfill_link} — or just reply and we'll go at your pace.",
      }),
      step({
        step_number: 9,
        step_type: 'fub_task',
        delay_days: 5,
        fub_task_type: 'Call',
        fub_task_name_template:
          "Call #4 (final friendly try): {first_name} — Just wanted to make sure you have what you need; I'm here whenever.",
        fub_remind_seconds_before: 900,
      }),
      step({
        step_number: 10,
        step_type: 'email',
        delay_days: 6,
        email_subject_template: 'Should I keep helping with your {city} search?',
        message_template:
          "Hi {first_name},\n\nI've reached out a few times and don't want to fill up your inbox. No worries at all if the timing isn't right — just reply with a 1, 2, or 3 and I'll take it from there:\n\n1 — Still interested. I'll send you some times this week.\n2 — Not right now, but keep me posted. I'll send a short {city} update once a month, no pressure.\n3 — All set. No problem, I'll close things out.\n\nEither way, I'm here whenever you need me. Thanks, {first_name}.\n\n— Fahad",
      }),
      step({
        step_number: 11,
        step_type: 'fub_task',
        delay_days: 6,
        delay_hours: 2,
        fub_task_type: 'Follow Up',
        fub_task_name_template:
          'Handoff: {first_name} — no reply after 7-Day Fast Start → enroll in Pre-Con 14-Day Warm-Up.',
      }),
    ],
  },

  {
    id: 'precon-14-day-warm-up',
    name: 'Pre-Con — 14-Day Warm-Up',
    description:
      'For 7-Day non-responders or "not now" leads. Slower, value-first cadence: 3 text, 2 call, 4 email over 14 days. Earn the call by being helpful. Hand off to Monthly Keep-in-Touch. Tag: precon-14-day-warm-up.',
    category: 'mid',
    steps: [
      step({
        step_number: 1,
        step_type: 'email',
        delay_days: 1,
        email_subject_template: 'An honest take on buying new in {city} right now',
        message_template:
          "Hi {first_name}, no pitch here — just a quick, honest read. Right now, builders in {city} are offering easier deposit plans and capped fees on their new projects, which is nice for buyers. Whenever you're ready — this month or next year — I'll happily show you which ones have the best terms. Truly no rush; I'm just here to help when it's the right time for you. — Fahad",
      }),
      step({
        step_number: 2,
        step_type: 'sms',
        delay_days: 1,
        delay_hours: 4,
        message_template:
          "Hi {first_name}, no rush at all — just checking in on {project}. Are you still thinking about {city}, or has your timing changed? Happy to keep you posted either way. — Fahad",
      }),
      step({
        step_number: 3,
        step_type: 'email',
        delay_days: 3,
        email_subject_template: 'How deposits and pre-construction really work (in plain words)',
        message_template:
          "Hi {first_name},\n\nThe two things people worry about most with new homes are the deposit and \"what if my life changes before it's built.\" Good news — both are easier than they seem. Most projects let you pay the deposit in small pieces over 1–2 years, and you can usually sell your contract before it's finished if you ever need to. I can explain it all in about 10 minutes, no obligation.\n\nBook a no-pressure chat: {qikfill_link}\n\n— Fahad",
      }),
      step({
        step_number: 4,
        step_type: 'fub_task',
        delay_days: 4,
        fub_task_type: 'Call',
        fub_task_name_template:
          'Warm call: {first_name} — "Just making sure your questions about {project} got answered."',
        fub_remind_seconds_before: 900,
      }),
      step({
        step_number: 5,
        step_type: 'sms',
        delay_days: 6,
        message_template:
          "Hi {first_name}, I pulled a floor plan / unit option for {project} that might fit what you were looking at in {city}. Want me to send it over? — Fahad",
      }),
      step({
        step_number: 6,
        step_type: 'email',
        delay_days: 8,
        email_subject_template: 'How another {city} buyer found the right project',
        message_template:
          "Hi {first_name},\n\nQuick story — a buyer I worked with last month was set on one {city} project, but after comparing a few options side by side, they found a better deposit plan and saved on closing costs elsewhere. Same timeline, less stress.\n\nIf you'd like, I can do the same comparison for you — 15 minutes, no pressure: {qikfill_link}\n\n— Fahad",
      }),
      step({
        step_number: 7,
        step_type: 'fub_task',
        delay_days: 10,
        fub_task_type: 'Call',
        fub_task_name_template:
          'Call #2: {first_name} — fresh reason (new deal or unit on {project} / {city}).',
        fub_remind_seconds_before: 900,
      }),
      step({
        step_number: 8,
        step_type: 'sms',
        delay_days: 12,
        message_template:
          "Hi {first_name}, just so you have it — there's a nice deal on one of the {city} projects right now. No pressure at all, but if you'd like me to check whether it fits what you're after, I'm glad to. I'm here whenever you need me: {qikfill_link}",
      }),
      step({
        step_number: 9,
        step_type: 'email',
        delay_days: 13,
        email_subject_template: 'Want to stay on my {city} update list?',
        message_template:
          "Hi {first_name},\n\nI'll keep this short — would you like me to send a monthly {city} new-home update (new projects, prices, deals)? No calls unless you ask. Just reply YES to stay on the list, or NO and I'll step back.\n\nThanks,\nFahad",
      }),
      step({
        step_number: 10,
        step_type: 'fub_task',
        delay_days: 13,
        delay_hours: 4,
        fub_task_type: 'Follow Up',
        fub_task_name_template:
          'Handoff: {first_name} — 14-Day Warm-Up complete → enroll in Pre-Con Monthly Keep-in-Touch.',
      }),
    ],
  },

  {
    id: 'precon-monthly-keep-in-touch',
    name: 'Pre-Con — Monthly Keep-in-Touch',
    description:
      'Long-term nurture for future buyers: monthly email + text value drops, quarterly call. ~30% of sales come from 6+ month leads. Any reply → re-enroll in 7-Day Fast Start. Tag: precon-monthly-keep-in-touch.',
    category: 'long',
    steps: [
      step({
        step_number: 1,
        step_type: 'email',
        delay_days: 1,
        email_subject_template: "What's new with {city} new homes this month",
        message_template:
          "Hi {first_name},\n\nHere's your quick 60-second {city} update: which projects just launched, how prices are moving, and which deals are new or ending soon. No pitch — just keeping you in the loop so you're ready whenever your timing lands. If anything looks interesting, just reply \"tell me more.\"\n\n— Fahad",
      }),
      step({
        step_number: 2,
        step_type: 'sms',
        delay_days: 7,
        message_template:
          "Hi {first_name}, a new {city} project just opened for early sign-ups (before it goes public). Thought of you since you'd looked at {project}. Want the prices and floor plans? Just reply \"yes\" and I'll send them over. — Fahad",
      }),
      step({
        step_number: 3,
        step_type: 'email',
        delay_days: 14,
        email_subject_template: 'Pre-con basics: closing costs, rebates & investor tips',
        message_template:
          "Hi {first_name},\n\nA quick how-to this month — three things buyers ask me most about new homes in {city}:\n\n• Closing costs — what's typical and what builders sometimes cover.\n• Rebates & incentives — how to tell a real deal from marketing fluff.\n• Investor basics — deposit structure and assignment rules in plain English.\n\nReply anytime if you want me to walk through any of it on a quick call.\n\n— Fahad",
      }),
      step({
        step_number: 4,
        step_type: 'fub_task',
        delay_days: 90,
        fub_task_type: 'Call',
        fub_task_name_template:
          'Quarterly check-in: {first_name} — still on your radar for {city}? Re-enroll in 7-Day if ready.',
        fub_remind_seconds_before: 900,
      }),
    ],
  },
];
