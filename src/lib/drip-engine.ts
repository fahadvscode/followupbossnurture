import { getServiceClient } from './supabase';
import { sendSMS, renderTemplate } from './twilio';
import { plainTextToHtml, htmlToPlainText, sendSmtpIfConfigured } from './email';
import {
  pushEvent,
  createFubTask,
  createEmCampaign,
  postEmEmailDelivered,
  applyActionPlan,
} from './fub';
import { normalizePhone, formatDripStepDayLabel } from './utils';
import { deliveryErrorMeta } from './delivery-error-meta';
import { sendAiMessage } from './ai-engine';
import type { DripContact, DripCampaignStep, DripEnrollment } from '@/types';

interface CampaignSendContext {
  name: string;
  twilio_from_number: string | null;
}

interface DueMessage {
  enrollment: DripEnrollment;
  contact: DripContact;
  step: DripCampaignStep;
  campaign: CampaignSendContext;
}

type StepKind = 'sms' | 'email' | 'fub_action_plan' | 'fub_task';

function stepKind(step: DripCampaignStep): StepKind {
  const t = step.step_type;
  if (t === 'fub_task') return 'fub_task';
  if (t === 'fub_action_plan') return 'fub_action_plan';
  if (t === 'email') return 'email';
  return 'sms';
}

function resolveFubEmailUserId(step: DripCampaignStep): number | undefined {
  const sid = step.fub_email_user_id;
  if (sid != null && Number.isFinite(Number(sid))) {
    return Number(sid);
  }
  const raw =
    process.env.FUB_EMAIL_USER_ID?.trim() ||
    process.env.FUB_DEFAULT_TASK_ASSIGNED_USER_ID?.trim();
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

function resolveFubTaskAssignee(
  step: DripCampaignStep,
  contact: DripContact
): { assignedUserId?: number; assignedTo?: string } {
  const sid = step.fub_assigned_user_id;
  if (sid != null && Number.isFinite(Number(sid))) {
    return { assignedUserId: Number(sid) };
  }
  const envRaw = process.env.FUB_DEFAULT_TASK_ASSIGNED_USER_ID?.trim();
  if (envRaw) {
    const n = parseInt(envRaw, 10);
    if (Number.isFinite(n)) return { assignedUserId: n };
  }
  const name = contact.assigned_agent?.trim();
  if (name) return { assignedTo: name };
  return {};
}

function templateVars(contact: DripContact, campaignName: string): Record<string, string> {
  return {
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    project: contact.source_detail || campaignName,
    campaign: campaignName,
  };
}

function safePushToFub(fubId: number | null, event: { type: string; message: string; source: string }) {
  if (fubId == null) return;
  pushEvent(fubId, event).catch((e) =>
    console.error('Timeline push failed:', e)
  );
}

// ─── Find due messages ───────────────────────────────────────────────

export type DripSkipDiagnostic = {
  enrollmentId: string;
  campaignId: string;
  campaignName: string;
  contactId: string;
  contactLabel: string;
  reason: string;
  detail?: string;
};

type CampaignRowEmbed = {
  name: string;
  status: string;
  twilio_from_number: string | null;
  campaign_type?: string | null;
};

function unwrapOne<T>(row: T | T[] | null | undefined): T | null {
  if (row == null) return null;
  return Array.isArray(row) ? (row[0] ?? null) : row;
}

export async function findDueMessagesWithDiagnostics(): Promise<{
  due: DueMessage[];
  skips: DripSkipDiagnostic[];
}> {
  const db = getServiceClient();
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const skips: DripSkipDiagnostic[] = [];

  const { data: enrollments, error } = await db
    .from('drip_enrollments')
    .select(`*, contact:drip_contacts(*), campaign:drip_campaigns(*)`)
    .eq('status', 'active');

  if (error || !enrollments) {
    console.error('Error fetching enrollments:', error);
    return {
      due: [],
      skips: [
        {
          enrollmentId: '—',
          campaignId: '—',
          campaignName: '—',
          contactId: '—',
          contactLabel: '—',
          reason: 'enrollment_query_failed',
          detail: error?.message,
        },
      ],
    };
  }

  const dueMessages: DueMessage[] = [];

  for (const row of enrollments) {
    const enrollment = row as DripEnrollment & {
      contact?: DripContact | DripContact[] | null;
      campaign?: CampaignRowEmbed | CampaignRowEmbed[] | null;
    };

    const contact = unwrapOne(enrollment.contact);
    const campaignRow = unwrapOne(enrollment.campaign);

    const contactLabel = contact
      ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() ||
        contact.phone ||
        contact.email ||
        contact.id
      : '(no contact row)';

    const campaignName = campaignRow?.name || 'Campaign';

    const pushSkip = (reason: string, detail?: string) => {
      skips.push({
        enrollmentId: enrollment.id,
        campaignId: enrollment.campaign_id,
        campaignName,
        contactId: enrollment.contact_id,
        contactLabel,
        reason,
        detail,
      });
    };

    if (!contact) {
      pushSkip('contact_join_missing', 'drip_contacts row missing or RLS blocked embed');
      continue;
    }

    if (!campaignRow || campaignRow.status !== 'active') {
      pushSkip('campaign_not_active', campaignRow ? `status=${campaignRow.status}` : 'campaign row missing');
      continue;
    }

    if (contact.opted_out) {
      pushSkip('contact_opted_out');
      continue;
    }

    const campaign: CampaignSendContext = {
      name: campaignName,
      twilio_from_number: campaignRow.twilio_from_number ?? null,
    };

    const nextStepNumber = enrollment.current_step + 1;

    const { data: stepRow, error: stepErr } = await db
      .from('drip_campaign_steps')
      .select('*')
      .eq('campaign_id', enrollment.campaign_id)
      .eq('step_number', nextStepNumber)
      .maybeSingle();

    if (stepErr) {
      pushSkip('step_load_error', stepErr.message);
      continue;
    }

    if (!stepRow) {
      if (campaignRow.campaign_type === 'ai_nurture') {
        pushSkip(
          'ai_nurture_no_drip_steps',
          'AI nurture uses the AI engine + cron, not step-based drips'
        );
        continue;
      }
      await db
        .from('drip_enrollments')
        .update({ status: 'completed', completed_at: now })
        .eq('id', enrollment.id);
      continue;
    }

    const step = stepRow as DripCampaignStep;
    const kind = stepKind(step);

    const d = Number(step.delay_days) || 0;
    const h = Number(step.delay_hours) || 0;
    const m = Number(step.delay_minutes) || 0;
    const enrolledAt = new Date(enrollment.enrolled_at);
    const delayMs = ((d * 24 + h) * 60 + m) * 60 * 1000;
    const dueAt = new Date(enrolledAt.getTime() + delayMs);

    if (nowMs < dueAt.getTime()) {
      pushSkip(
        'not_due_yet',
        `step ${nextStepNumber} due at ${dueAt.toISOString()} (from enrolled_at ${enrollment.enrolled_at})`
      );
      continue;
    }

    const missingChannel =
      (kind === 'sms' && !contact.phone?.trim()) ||
      (kind === 'email' && !contact.email?.trim()) ||
      ((kind === 'fub_task' || kind === 'fub_action_plan') && contact.fub_id == null);

    if (missingChannel) {
      const why =
        kind === 'sms'
          ? 'no_phone'
          : kind === 'email'
            ? 'no_email'
            : 'no_fub_id';
      await advanceEnrollment(db, enrollment, step.step_number);
      pushSkip('auto_advanced_missing_channel', `Step ${nextStepNumber} (${kind}) was due but ${why}; enrollment advanced without sending.`);
      continue;
    }

    dueMessages.push({ enrollment, contact, step, campaign });
  }

  return { due: dueMessages, skips };
}

export async function findDueMessages(): Promise<DueMessage[]> {
  const { due } = await findDueMessagesWithDiagnostics();
  return due;
}

// ─── Dispatch ────────────────────────────────────────────────────────

export async function processDueMessage(msg: DueMessage): Promise<boolean> {
  switch (stepKind(msg.step)) {
    case 'fub_task':
      return processFubTaskStep(msg);
    case 'fub_action_plan':
      return processFubActionPlanStep(msg);
    case 'email':
      return processEmailStep(msg);
    default:
      return processSmsStep(msg);
  }
}

// ─── Shared: advance enrollment ─────────────────────────────────────

async function advanceEnrollment(
  db: ReturnType<typeof getServiceClient>,
  enrollment: DripEnrollment,
  stepNumber: number
) {
  const now = new Date().toISOString();
  const { count } = await db
    .from('drip_campaign_steps')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', enrollment.campaign_id);

  const isLastStep = stepNumber >= (count || 0);

  await db
    .from('drip_enrollments')
    .update({
      current_step: stepNumber,
      ...(isLastStep ? { status: 'completed', completed_at: now } : {}),
    })
    .eq('id', enrollment.id);
}

// ─── SMS (Twilio) + push outbound text to FUB timeline ──────────────

async function processSmsStep(msg: DueMessage): Promise<boolean> {
  const db = getServiceClient();
  const { enrollment, contact, step, campaign } = msg;
  const now = new Date().toISOString();

  const phone = normalizePhone(contact.phone);
  if (!phone) return false;

  const body = renderTemplate(step.message_template, templateVars(contact, campaign.name));

  try {
    const result = await sendSMS(phone, body, campaign.twilio_from_number);

    await db.from('drip_messages').insert({
      enrollment_id: enrollment.id,
      contact_id: contact.id,
      campaign_id: enrollment.campaign_id,
      step_number: step.step_number,
      direction: 'outbound',
      body,
      twilio_sid: result.sid,
      status: result.status === 'queued' ? 'queued' : 'sent',
      sent_at: now,
      channel: 'sms',
    });

    await advanceEnrollment(db, enrollment, step.step_number);

    safePushToFub(contact.fub_id, {
      type: 'outgoing_sms',
      source: 'Drip Platform',
      message: `[Drip: ${campaign.name} · ${formatDripStepDayLabel(step)}] ${body}`,
    });

    return true;
  } catch (error) {
    console.error(`SMS failed ${phone}:`, error);

    await db.from('drip_messages').insert({
      enrollment_id: enrollment.id,
      contact_id: contact.id,
      campaign_id: enrollment.campaign_id,
      step_number: step.step_number,
      direction: 'outbound',
      body,
      status: 'failed',
      sent_at: now,
      channel: 'sms',
      error_detail: deliveryErrorMeta(error, 'twilio', 'send'),
    });

    return false;
  }
}

// ─── Email (FUB marketing timeline + optional SMTP) ─────────────────

async function processEmailStep(msg: DueMessage): Promise<boolean> {
  const db = getServiceClient();
  const { enrollment, contact, step, campaign } = msg;
  const now = new Date().toISOString();
  const to = contact.email?.trim();
  if (!to) return false;

  const vars = templateVars(contact, campaign.name);
  const subject = renderTemplate(step.email_subject_template || 'Follow up', vars).trim() || 'Follow up';
  const bodyRaw = renderTemplate(step.message_template, vars);
  const isHtml = step.email_body_format === 'html';
  const html = isHtml ? bodyRaw : plainTextToHtml(bodyRaw);
  const body = isHtml ? htmlToPlainText(bodyRaw) || htmlToPlainText(html) : bodyRaw;

  try {
    const originId = `${enrollment.id}-${step.step_number}-${Date.now()}`;
    const emName = `${campaign.name} · ${formatDripStepDayLabel(step)}`.slice(0, 240);

    const { id: fubCampaignId } = await createEmCampaign({
      originId,
      name: emName,
      subject,
      bodyHtml: html,
    });

    let smtpSent = false;
    if (process.env.SMTP_HOST?.trim()) {
      smtpSent = await sendSmtpIfConfigured(to, subject, body, html);
    }

    await postEmEmailDelivered({
      campaignId: fubCampaignId,
      recipient: to,
      occurred: now,
      personId: contact.fub_id ?? undefined,
      userId: resolveFubEmailUserId(msg.step),
    });

    const logBody = `[Email — FUB timeline${smtpSent ? ' + inbox (SMTP)' : ''}] ${subject}\n\n${body}`;

    await db.from('drip_messages').insert({
      enrollment_id: enrollment.id,
      contact_id: contact.id,
      campaign_id: enrollment.campaign_id,
      step_number: step.step_number,
      direction: 'outbound',
      body: logBody,
      twilio_sid: `fub-em-${fubCampaignId}`,
      status: 'sent',
      sent_at: now,
      channel: 'email',
    });

    await advanceEnrollment(db, enrollment, step.step_number);
    return true;
  } catch (error) {
    console.error(`Email failed ${to}:`, error);

    await db.from('drip_messages').insert({
      enrollment_id: enrollment.id,
      contact_id: contact.id,
      campaign_id: enrollment.campaign_id,
      step_number: step.step_number,
      direction: 'outbound',
      body: `[Email failed] ${subject}`,
      status: 'failed',
      sent_at: now,
      channel: 'email',
      error_detail: deliveryErrorMeta(error, 'email', 'send'),
    });

    return false;
  }
}

// ─── FUB Action Plan (email via connected inbox) ─────────────────────

async function processFubActionPlanStep(msg: DueMessage): Promise<boolean> {
  const db = getServiceClient();
  const { enrollment, contact, step, campaign } = msg;
  const now = new Date().toISOString();
  const fubId = contact.fub_id;

  if (fubId == null) return false;

  const actionPlanId = step.fub_action_plan_id;
  if (actionPlanId == null || !Number.isFinite(actionPlanId)) {
    console.error('FUB action plan step: no action plan ID set');
    await db.from('drip_messages').insert({
      enrollment_id: enrollment.id,
      contact_id: contact.id,
      campaign_id: enrollment.campaign_id,
      step_number: step.step_number,
      direction: 'outbound',
      body: `[FUB action plan failed] No action plan ID configured on step`,
      status: 'failed',
      sent_at: now,
      channel: 'fub_action_plan',
      error_detail: deliveryErrorMeta(
        new Error('No action plan ID configured on step'),
        'app',
        'config'
      ),
    });
    return false;
  }

  const label =
    (step.fub_task_name_template || '').trim() ||
    (step.message_template || '').trim() ||
    `Action plan #${actionPlanId}`;

  try {
    await applyActionPlan(fubId, actionPlanId);

    const logBody = `[FUB action plan #${actionPlanId}] ${label}`;

    await db.from('drip_messages').insert({
      enrollment_id: enrollment.id,
      contact_id: contact.id,
      campaign_id: enrollment.campaign_id,
      step_number: step.step_number,
      direction: 'outbound',
      body: logBody,
      twilio_sid: `fub-ap-${actionPlanId}`,
      status: 'delivered',
      sent_at: now,
      channel: 'fub_action_plan',
    });

    await advanceEnrollment(db, enrollment, step.step_number);

    safePushToFub(fubId, {
      type: 'Note',
      source: 'Drip Platform',
      message: `[Drip: ${campaign.name} · ${formatDripStepDayLabel(step)}] Applied action plan: ${label}`,
    });

    return true;
  } catch (error) {
    console.error(`FUB action plan failed for person ${fubId}:`, error);

    await db.from('drip_messages').insert({
      enrollment_id: enrollment.id,
      contact_id: contact.id,
      campaign_id: enrollment.campaign_id,
      step_number: step.step_number,
      direction: 'outbound',
      body: `[FUB action plan failed] ${label}`,
      status: 'failed',
      sent_at: now,
      channel: 'fub_action_plan',
      error_detail: deliveryErrorMeta(error, 'fub', 'send'),
    });

    return false;
  }
}

// ─── FUB Task + push timeline event ─────────────────────────────────

async function processFubTaskStep(msg: DueMessage): Promise<boolean> {
  const db = getServiceClient();
  const { enrollment, contact, step, campaign } = msg;
  const now = new Date().toISOString();
  const fubId = contact.fub_id;

  if (fubId == null) return false;

  const vars = templateVars(contact, campaign.name);
  const nameTemplate =
    (step.fub_task_name_template || '').trim() || step.message_template || '';
  const taskName = renderTemplate(nameTemplate, vars).trim() || `Follow up — ${campaign.name}`;

  const assignee = resolveFubTaskAssignee(step, contact);
  if (assignee.assignedUserId == null && !assignee.assignedTo) {
    console.error('FUB task step: no assignee resolvable');
    await db.from('drip_messages').insert({
      enrollment_id: enrollment.id,
      contact_id: contact.id,
      campaign_id: enrollment.campaign_id,
      step_number: step.step_number,
      direction: 'outbound',
      body: `[FUB task failed] ${taskName} — no assignee`,
      status: 'failed',
      sent_at: now,
      channel: 'fub_task',
      error_detail: deliveryErrorMeta(
        new Error('No FUB assignee: set step assignee, FUB_DEFAULT_TASK_ASSIGNED_USER_ID, or contact assigned agent'),
        'app',
        'config'
      ),
    });
    return false;
  }

  const offsetMin = Math.max(0, Number(step.fub_due_offset_minutes) || 0);
  const due = new Date(Date.now() + offsetMin * 60 * 1000);
  const dueDateTime = due.toISOString();

  const remind =
    step.fub_remind_seconds_before != null && Number.isFinite(Number(step.fub_remind_seconds_before))
      ? Number(step.fub_remind_seconds_before)
      : undefined;

  try {
    await createFubTask({
      personId: fubId,
      name: taskName,
      type: step.fub_task_type || 'Call',
      dueDateTime,
      assignedUserId: assignee.assignedUserId,
      assignedTo: assignee.assignedTo,
      remindSecondsBefore: remind,
    });

    const logBody = `[FUB task] ${taskName} (due ${dueDateTime})`;

    await db.from('drip_messages').insert({
      enrollment_id: enrollment.id,
      contact_id: contact.id,
      campaign_id: enrollment.campaign_id,
      step_number: step.step_number,
      direction: 'outbound',
      body: logBody,
      status: 'delivered',
      sent_at: now,
      channel: 'fub_task',
    });

    await advanceEnrollment(db, enrollment, step.step_number);

    safePushToFub(fubId, {
      type: 'Note',
      source: 'Drip Platform',
      message: `[Drip: ${campaign.name} · ${formatDripStepDayLabel(step)}] Created task: ${taskName}`,
    });

    return true;
  } catch (error) {
    console.error(`FUB task failed for person ${fubId}:`, error);

    await db.from('drip_messages').insert({
      enrollment_id: enrollment.id,
      contact_id: contact.id,
      campaign_id: enrollment.campaign_id,
      step_number: step.step_number,
      direction: 'outbound',
      body: `[FUB task failed] ${taskName}`,
      status: 'failed',
      sent_at: now,
      channel: 'fub_task',
      error_detail: deliveryErrorMeta(error, 'fub', 'send'),
    });

    return false;
  }
}

// ─── AI Nurture: first SMS after any enrollment (manual, auto, etc.) ──

/**
 * Call after an enrollment row is created. For `ai_nurture` campaigns, sends
 * the first AI message when `DEEPSEEK_API_KEY` and contact phone exist.
 * Idempotent in practice: safe to call once per new enrollment.
 */
export async function sendAiNurtureFirstTouchAfterEnroll(params: {
  enrollmentId: string;
  contactId: string;
  campaignId: string;
}): Promise<void> {
  const { enrollmentId, contactId, campaignId } = params;
  const db = getServiceClient();
  const { data: campaign } = await db
    .from('drip_campaigns')
    .select('campaign_type, status')
    .eq('id', campaignId)
    .single();

  if (campaign?.campaign_type !== 'ai_nurture' || campaign.status !== 'active') {
    return;
  }
  if (!process.env.DEEPSEEK_API_KEY?.trim()) {
    console.warn('sendAiNurtureFirstTouch: DEEPSEEK_API_KEY is not set; skipping first AI SMS');
    return;
  }
  const { data: contactRow } = await db
    .from('drip_contacts')
    .select('*')
    .eq('id', contactId)
    .single();
  if (!contactRow) return;

  await sendAiMessage({
    enrollmentId,
    contactId,
    campaignId,
    contact: contactRow,
    isFollowUp: false,
  }).catch((e) => console.error('AI first-touch failed:', e));
}

// ─── Auto-enrollment ─────────────────────────────────────────────────

function tagMatchesTrigger(contactTags: string[], trigger: string): boolean {
  const t = trigger.trim().toLowerCase();
  if (!t) return false;
  return contactTags.some((tag) => tag.toLowerCase() === t || tag.toLowerCase().includes(t));
}

export async function autoEnrollContact(contactId: string, tags: string[], sourceCategory: string) {
  const db = getServiceClient();

  const { data: campaigns } = await db
    .from('drip_campaigns')
    .select('*')
    .eq('status', 'active');

  if (!campaigns) return;

  const normalizedTags = Array.isArray(tags) ? tags : [];

  for (const campaign of campaigns) {
    const tagMatch = (campaign.trigger_tags || []).some((tr: string) =>
      tagMatchesTrigger(normalizedTags, tr)
    );
    const sourceMatch = (campaign.trigger_sources || []).some((s: string) =>
      s.toLowerCase() === sourceCategory.toLowerCase()
    );

    if (!tagMatch && !sourceMatch) continue;

    const { data: existing } = await db
      .from('drip_enrollments')
      .select('id')
      .eq('contact_id', contactId)
      .eq('campaign_id', campaign.id)
      .maybeSingle();

    if (existing) continue;

    const { data: enrollment } = await db
      .from('drip_enrollments')
      .insert({
        contact_id: contactId,
        campaign_id: campaign.id,
        status: 'active',
        current_step: 0,
        enrolled_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (enrollment) {
      void sendAiNurtureFirstTouchAfterEnroll({
        enrollmentId: enrollment.id,
        contactId,
        campaignId: campaign.id,
      });
    }
  }
}
