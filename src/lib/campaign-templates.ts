import type { CampaignStepForm } from '@/components/campaigns/StepEditor';
import { PRECON_CAMPAIGN_TEMPLATES } from '@/lib/campaign-templates-precon';

/** A prebuilt drip campaign the user can start from (in-app picker) or seed via SQL. */
export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: 'short' | 'mid' | 'long' | 'other';
  steps: TemplateStep[];
}

/** Step shape used by templates: same as the campaign form step, minus the row id. */
export type TemplateStep = Omit<CampaignStepForm, 'id'>;

type StepInput = Partial<TemplateStep> & {
  step_number: number;
  step_type: TemplateStep['step_type'];
};

/** Fill a template step with safe defaults so every field the form expects is present. */
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

export const CATEGORY_LABELS: Record<CampaignTemplate['category'], string> = {
  short: 'Short-term',
  mid: 'Mid-term',
  long: 'Long-term',
  other: 'Other',
};

export function getCampaignTemplateById(id: string): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find((t) => t.id === id);
}

export function templateChannelCounts(steps: TemplateStep[]) {
  return {
    sms: steps.filter((s) => s.step_type === 'sms').length,
    email: steps.filter((s) => s.step_type === 'email').length,
    task: steps.filter((s) => s.step_type === 'fub_task' || s.step_type === 'fub_action_plan').length,
  };
}

export function templateDurationLabel(steps: TemplateStep[]): string {
  const maxDays = steps.reduce((max, s) => Math.max(max, s.delay_days), 0);
  if (maxDays >= 1) return `${maxDays} day${maxDays === 1 ? '' : 's'}`;
  return 'Same day';
}

export const TEMPLATE_CATEGORY_ORDER: CampaignTemplate['category'][] = ['other', 'short', 'mid', 'long'];

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  // ── Speed-to-Lead ──────────────────────────────────────────────────
  {
    id: 'speed-to-lead',
    name: 'Speed-to-Lead (Quick Response)',
    description:
      'Instant same-day blitz for brand-new leads: text in seconds, call within 5 minutes, email at 30 minutes, second call attempt same day.',
    category: 'other',
    steps: [
      step({
        step_number: 1,
        step_type: 'sms',
        message_template:
          "Hi {first_name}, thanks for reaching out about {project}! This is your agent — are you looking to buy, sell, or invest? Happy to help right away.",
      }),
      step({
        step_number: 2,
        step_type: 'fub_task',
        delay_minutes: 5,
        fub_task_type: 'Call',
        fub_task_name_template: 'Speed-to-lead call: {first_name} about {project} (call within 5 min!)',
        fub_remind_seconds_before: 300,
      }),
      step({
        step_number: 3,
        step_type: 'email',
        delay_minutes: 30,
        email_subject_template: '{first_name}, here are the details on {project}',
        message_template:
          "Hi {first_name},\n\nThanks again for your interest in {project}. Here's what I can send over right away:\n\n• Current pricing and available incentives\n• Floor plans and inventory\n• Neighborhood and community details\n\nWhat's the best number and time to reach you? Just reply here or text me anytime.\n\nTalk soon!",
      }),
      step({
        step_number: 4,
        step_type: 'fub_task',
        delay_hours: 3,
        fub_task_type: 'Call',
        fub_task_name_template: '2nd call attempt: {first_name} ({project}) — different time of day',
        fub_remind_seconds_before: 900,
      }),
      step({
        step_number: 5,
        step_type: 'sms',
        delay_hours: 6,
        message_template:
          "Hi {first_name}, just following up on {project}. I have current pricing and floor plans ready — want me to send them over?",
      }),
    ],
  },

  // ── Short-term: 7-Day ISA Blitz ────────────────────────────────────
  {
    id: 'isa-7-day',
    name: 'Short-Term — 7-Day ISA Blitz',
    description:
      '10 touches over 7 days: 3× text, 4× call tasks, 2× email, 1× nurture handoff. The proven ISA cadence for new leads.',
    category: 'short',
    steps: [
      step({
        step_number: 1,
        step_type: 'sms',
        message_template:
          'Hi {first_name}, thanks for interest in {project}! Quick Q — live-in or invest? I have early access pricing.',
      }),
      step({
        step_number: 2,
        step_type: 'fub_task',
        delay_minutes: 5,
        fub_task_type: 'Call',
        fub_task_name_template:
          'First call attempt + voicemail: {first_name} — "I have exclusive pricing + floor plans, call back or reply!"',
        fub_remind_seconds_before: 300,
      }),
      step({
        step_number: 3,
        step_type: 'email',
        delay_minutes: 30,
        email_subject_template: "Here's the exclusive info you requested on {project}",
        message_template:
          "Hi {first_name},\n\nHere's the exclusive info you requested on {project}.\n\n• Early access pricing & current incentives\n• Available floor plans & lot inventory\n• Community highlights & neighborhood details\n\nThis is moving quickly — happy to walk you through everything whenever it's convenient. Just reply to this email or give me a call.\n\nLooking forward to connecting!",
      }),
      step({
        step_number: 4,
        step_type: 'fub_task',
        delay_days: 1,
        fub_task_type: 'Call',
        fub_task_name_template: '2nd call: {first_name} ({project}). Different time of day. No voicemail.',
        fub_remind_seconds_before: 900,
      }),
      step({
        step_number: 5,
        step_type: 'sms',
        delay_days: 1,
        message_template:
          'Hey {first_name}, tried calling about {project}. Floor plans going fast — want me to send?',
      }),
      step({
        step_number: 6,
        step_type: 'fub_task',
        delay_days: 3,
        fub_task_type: 'Call',
        fub_task_name_template: '3rd call: {first_name} ({project}). Try morning if previous were afternoon.',
        fub_remind_seconds_before: 900,
      }),
      step({
        step_number: 7,
        step_type: 'email',
        delay_days: 3,
        email_subject_template: 'Quick update — builder released new incentives for {project}',
        message_template:
          "Hi {first_name},\n\nQuick update — the builder just released new incentives for {project}. Worth a look while they last.\n\nWant me to send the updated pricing sheet? Just reply and I'll get it right over.",
      }),
      step({
        step_number: 8,
        step_type: 'sms',
        delay_days: 6,
        message_template:
          "Closing the loop on {project}, {first_name}. Not the right time? No problem — I'll keep you posted on new releases.",
      }),
      step({
        step_number: 9,
        step_type: 'fub_task',
        delay_days: 6,
        fub_task_type: 'Call',
        fub_task_name_template: 'Final call: {first_name}. No answer → move to Nurture in FUB.',
        fub_remind_seconds_before: 900,
      }),
      step({
        step_number: 10,
        step_type: 'fub_task',
        delay_days: 13,
        fub_task_type: 'Follow Up',
        fub_task_name_template:
          'Nurture handoff: {first_name} enters monthly nurture cadence. No more manual ISA outreach.',
      }),
    ],
  },

  // ── Mid-term: 30-Day Nurture ───────────────────────────────────────
  {
    id: 'nurture-30-day',
    name: 'Mid-Term — 30-Day Nurture',
    description:
      '8 touches across 30 days: alternating SMS and email value drops with periodic call tasks and reminders. Great for leads who are interested but not ready yet.',
    category: 'mid',
    steps: [
      step({
        step_number: 1,
        step_type: 'sms',
        delay_days: 1,
        message_template:
          "Hi {first_name}, checking in on {project}. No rush at all — I'm here whenever you're ready. Any questions I can answer?",
      }),
      step({
        step_number: 2,
        step_type: 'email',
        delay_days: 4,
        email_subject_template: '{first_name}, a few things to know about {project}',
        message_template:
          "Hi {first_name},\n\nWhile you're thinking about {project}, here are a few things buyers ask me most:\n\n• How pricing and incentives are trending\n• What's still available (and what's selling fast)\n• Deposit structure and timelines\n\nHappy to walk through any of it. Just reply and let me know what's most useful.",
      }),
      step({
        step_number: 3,
        step_type: 'fub_task',
        delay_days: 8,
        fub_task_type: 'Call',
        fub_task_name_template: 'Check-in call: {first_name} about {project} (week 1 nurture)',
        fub_remind_seconds_before: 900,
      }),
      step({
        step_number: 4,
        step_type: 'sms',
        delay_days: 12,
        message_template:
          'Hey {first_name}, thought of you — new inventory/pricing update on {project}. Want the latest details?',
      }),
      step({
        step_number: 5,
        step_type: 'email',
        delay_days: 18,
        email_subject_template: 'Is now a good time for {project}, {first_name}?',
        message_template:
          "Hi {first_name},\n\nMarkets and incentives shift month to month, so I wanted to check in on {project}.\n\nIf your timeline has changed — sooner or later — just let me know and I'll tailor what I send you. No pressure either way.",
      }),
      step({
        step_number: 6,
        step_type: 'fub_task',
        delay_days: 22,
        fub_task_type: 'Call',
        fub_task_name_template: 'Value call: {first_name} ({project}) — share latest incentives',
        fub_remind_seconds_before: 900,
      }),
      step({
        step_number: 7,
        step_type: 'sms',
        delay_days: 26,
        message_template:
          "Hi {first_name}, still happy to help with {project} whenever you're ready. Want me to keep you on the update list?",
      }),
      step({
        step_number: 8,
        step_type: 'email',
        delay_days: 30,
        email_subject_template: 'Keeping in touch on {project}',
        message_template:
          "Hi {first_name},\n\nI'll keep sending occasional updates on {project} so you're always in the loop. If anything changes on your end, I'm one reply away.\n\nTalk soon!",
      }),
    ],
  },

  // ── Long-term: 90-Day Nurture ──────────────────────────────────────
  {
    id: 'nurture-90-day',
    name: 'Long-Term — 90-Day Nurture',
    description:
      '7 light touches across 90 days (roughly every two weeks): low-pressure SMS and email check-ins plus a monthly call task. Keeps you top-of-mind for long timelines.',
    category: 'long',
    steps: [
      step({
        step_number: 1,
        step_type: 'sms',
        delay_days: 1,
        message_template:
          "Hi {first_name}, no rush on {project} — I'll check in now and then with anything useful. Reply anytime if your plans change.",
      }),
      step({
        step_number: 2,
        step_type: 'email',
        delay_days: 15,
        email_subject_template: '{first_name}, a quick {project} update',
        message_template:
          "Hi {first_name},\n\nJust a light check-in on {project}. Here's what's new:\n\n• Latest pricing and incentives\n• What's currently available\n\nNo action needed — just keeping you informed. Reply anytime if you'd like more detail.",
      }),
      step({
        step_number: 3,
        step_type: 'sms',
        delay_days: 30,
        message_template:
          'Hi {first_name}, thinking of you — anything change with your {project} timeline? Happy to help whenever the time is right.',
      }),
      step({
        step_number: 4,
        step_type: 'fub_task',
        delay_days: 45,
        fub_task_type: 'Call',
        fub_task_name_template: 'Monthly nurture call: {first_name} about {project}',
        fub_remind_seconds_before: 900,
      }),
      step({
        step_number: 5,
        step_type: 'email',
        delay_days: 60,
        email_subject_template: 'Still here for you on {project}, {first_name}',
        message_template:
          "Hi {first_name},\n\nMarkets move, so here's a fresh look at {project}:\n\n• Updated pricing / incentives\n• New availability\n\nIf your timeline is getting closer, let's talk. If not, I'll keep the updates coming.",
      }),
      step({
        step_number: 6,
        step_type: 'sms',
        delay_days: 75,
        message_template:
          'Hey {first_name}, quick check-in on {project}. Want me to keep sending updates, or pause for now? Totally your call.',
      }),
      step({
        step_number: 7,
        step_type: 'fub_task',
        delay_days: 90,
        fub_task_type: 'Follow Up',
        fub_task_name_template: 'Quarterly review: {first_name} ({project}) — reassess timeline and re-engage',
        fub_remind_seconds_before: 900,
      }),
    ],
  },

  // ── Open-House Follow-Up ───────────────────────────────────────────
  {
    id: 'open-house-follow-up',
    name: 'Open-House Follow-Up',
    description:
      'Days 0-10 after an open house: thank-you text, next-day call, day-2 email with similar listings, day-5 text, day-10 call.',
    category: 'other',
    steps: [
      step({
        step_number: 1,
        step_type: 'sms',
        message_template:
          "Hi {first_name}, great to meet you at the {project} open house! Thanks for stopping by. Any questions come to mind after seeing it?",
      }),
      step({
        step_number: 2,
        step_type: 'fub_task',
        delay_days: 1,
        fub_task_type: 'Call',
        fub_task_name_template: 'Open house follow-up call: {first_name} ({project})',
        fub_remind_seconds_before: 900,
      }),
      step({
        step_number: 3,
        step_type: 'email',
        delay_days: 2,
        email_subject_template: '{first_name}, homes like {project} you may love',
        message_template:
          "Hi {first_name},\n\nGreat meeting you at the {project} open house! Based on what you liked, here are a few similar options worth a look.\n\nWant me to put together a personalized list or set up private showings? Just reply and I'll get started.\n\nThanks again for coming by!",
      }),
      step({
        step_number: 4,
        step_type: 'sms',
        delay_days: 5,
        message_template:
          'Hi {first_name}, still thinking about {project}? Happy to answer questions or line up a few similar homes to see.',
      }),
      step({
        step_number: 5,
        step_type: 'fub_task',
        delay_days: 10,
        fub_task_type: 'Call',
        fub_task_name_template: 'Final open-house follow-up: {first_name} ({project}) — gauge interest, add to nurture if cold',
        fub_remind_seconds_before: 900,
      }),
    ],
  },

  // ── Past-Client / Sphere ───────────────────────────────────────────
  {
    id: 'past-client-sphere',
    name: 'Past-Client / Sphere',
    description:
      'Quarterly stay-in-touch for past clients and your sphere (days 1, 90, 180, 270, 365): friendly check-ins plus an annual home-review call.',
    category: 'long',
    steps: [
      step({
        step_number: 1,
        step_type: 'sms',
        delay_days: 1,
        message_template:
          "Hi {first_name}! Just checking in — hope you're doing great. Anything I can help with, or anyone you know who needs a hand with real estate?",
      }),
      step({
        step_number: 2,
        step_type: 'email',
        delay_days: 90,
        email_subject_template: 'Checking in, {first_name}',
        message_template:
          "Hi {first_name},\n\nHope all is well! Just staying in touch. If you ever have questions about your home's value, the market, or a friend who needs an agent, I'm always here.\n\nAlways happy to help — no strings attached.",
      }),
      step({
        step_number: 3,
        step_type: 'sms',
        delay_days: 180,
        message_template:
          'Hi {first_name}, thinking of you! Curious what your home might be worth today? Happy to send a quick estimate anytime.',
      }),
      step({
        step_number: 4,
        step_type: 'email',
        delay_days: 270,
        email_subject_template: 'A quick hello, {first_name}',
        message_template:
          "Hi {first_name},\n\nJust a friendly hello and a reminder that I'm here whenever you need real estate advice — for you or anyone you'd refer.\n\nWishing you all the best!",
      }),
      step({
        step_number: 5,
        step_type: 'fub_task',
        delay_days: 365,
        fub_task_type: 'Call',
        fub_task_name_template: 'Annual home review call: {first_name} — equity update + referral ask',
        fub_remind_seconds_before: 900,
      }),
    ],
  },

  // ── Cold-Lead Re-Engagement ────────────────────────────────────────
  {
    id: 'cold-lead-reengagement',
    name: 'Cold-Lead Re-Engagement',
    description:
      'Days 1-21 to win back quiet leads: re-intro text, day-3 email, day-7 call, day-14 "breakup" text, day-21 nurture handoff.',
    category: 'other',
    steps: [
      step({
        step_number: 1,
        step_type: 'sms',
        delay_days: 1,
        message_template:
          "Hi {first_name}, it's been a while! Still interested in {project} or something similar? Timelines change — happy to pick back up whenever.",
      }),
      step({
        step_number: 2,
        step_type: 'email',
        delay_days: 3,
        email_subject_template: 'Still thinking about {project}, {first_name}?',
        message_template:
          "Hi {first_name},\n\nWe connected a while back about {project} and I wanted to reach out again. A lot has changed — pricing, incentives, and availability.\n\nIf you're still exploring (even casually), reply and I'll send a quick update tailored to you. If now isn't the time, no worries at all.",
      }),
      step({
        step_number: 3,
        step_type: 'fub_task',
        delay_days: 7,
        fub_task_type: 'Call',
        fub_task_name_template: 'Re-engagement call: {first_name} ({project}) — is this still on their radar?',
        fub_remind_seconds_before: 900,
      }),
      step({
        step_number: 4,
        step_type: 'sms',
        delay_days: 14,
        message_template:
          "Hi {first_name}, I don't want to crowd your inbox. Should I keep sending {project} updates, or pause for now? Just reply KEEP or PAUSE.",
      }),
      step({
        step_number: 5,
        step_type: 'fub_task',
        delay_days: 21,
        fub_task_type: 'Follow Up',
        fub_task_name_template: 'Nurture handoff: {first_name} — move to long-term list if still unresponsive',
      }),
    ],
  },

  ...PRECON_CAMPAIGN_TEMPLATES,
];
