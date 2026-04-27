import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

type StepInput = Record<string, unknown>;

const VALID_STEP_TYPES = new Set(['sms', 'email', 'fub_action_plan', 'fub_task']);
const VALID_EMAIL_FORMATS = new Set(['plain', 'html']);

function mapStepRow(campaignId: string, step: StepInput) {
  const raw = String(step.step_type || 'sms');
  const step_type = VALID_STEP_TYPES.has(raw) ? raw : 'sms';
  const fmtRaw = String(step.email_body_format || 'plain');
  const email_body_format = VALID_EMAIL_FORMATS.has(fmtRaw) ? fmtRaw : 'plain';
  const uid = step.fub_assigned_user_id;
  const rid = step.fub_remind_seconds_before;
  const apid = step.fub_action_plan_id;
  const euid = step.fub_email_user_id;
  const uidStr = uid === '' || uid == null ? '' : String(uid).trim();
  const euidStr = euid === '' || euid == null ? '' : String(euid).trim();
  const ridStr = rid === '' || rid == null ? '' : String(rid).trim();
  const apidStr = apid === '' || apid == null ? '' : String(apid).trim();

  return {
    campaign_id: campaignId,
    step_number: Number(step.step_number),
    delay_days: Number(step.delay_days) || 0,
    delay_hours: Number(step.delay_hours) || 0,
    delay_minutes: Number(step.delay_minutes) || 0,
    message_template: String(step.message_template ?? ''),
    email_subject_template: String(step.email_subject_template ?? ''),
    email_body_format,
    step_type,
    fub_action_plan_id: apidStr !== '' && Number.isFinite(Number(apidStr)) ? Number(apidStr) : null,
    fub_task_type: String(step.fub_task_type || 'Call'),
    fub_task_name_template: String(step.fub_task_name_template ?? ''),
    fub_due_offset_minutes: Math.max(0, Number(step.fub_due_offset_minutes) || 0),
    fub_assigned_user_id: uidStr !== '' && Number.isFinite(Number(uidStr)) ? Number(uidStr) : null,
    fub_email_user_id: euidStr !== '' && Number.isFinite(Number(euidStr)) ? Number(euidStr) : null,
    fub_remind_seconds_before:
      ridStr !== '' && Number.isFinite(Number(ridStr)) ? Number(ridStr) : null,
  };
}

export async function GET(request: NextRequest) {
  const db = getServiceClient();
  const id = request.nextUrl.searchParams.get('id');

  if (id) {
    const [{ data: campaign }, { data: steps }] = await Promise.all([
      db.from('drip_campaigns').select('*').eq('id', id).single(),
      db.from('drip_campaign_steps').select('*').eq('campaign_id', id).order('step_number'),
    ]);

    if (!campaign) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ campaign, steps });
  }

  const { data: campaigns } = await db
    .from('drip_campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  const db = getServiceClient();
  const body = await request.json();

  const { steps, ...campaignData } = body;

  const { data: campaign, error } = await db
    .from('drip_campaigns')
    .insert({
      name: campaignData.name,
      description: campaignData.description,
      trigger_tags: campaignData.trigger_tags || [],
      trigger_sources: campaignData.trigger_sources || [],
      status: campaignData.status || 'active',
      twilio_from_number: campaignData.twilio_from_number?.trim() || null,
    })
    .select()
    .single();

  if (error || !campaign) {
    return NextResponse.json({ error: error?.message || 'Failed to create' }, { status: 500 });
  }

  if (steps && steps.length > 0) {
    const stepInserts = (steps as StepInput[]).map((s) => mapStepRow(campaign.id, s));
    await db.from('drip_campaign_steps').insert(stepInserts);
  }

  return NextResponse.json(campaign);
}

export async function PUT(request: NextRequest) {
  const db = getServiceClient();
  const body = await request.json();
  const { id, steps, ...updates } = body;

  const { error } = await db
    .from('drip_campaigns')
    .update({
      name: updates.name,
      description: updates.description,
      status: updates.status,
      trigger_tags: updates.trigger_tags || [],
      trigger_sources: updates.trigger_sources || [],
      twilio_from_number: updates.twilio_from_number?.trim() || null,
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (steps) {
    await db.from('drip_campaign_steps').delete().eq('campaign_id', id);

    if (steps.length > 0) {
      const stepInserts = (steps as StepInput[]).map((s) => mapStepRow(id, s));
      await db.from('drip_campaign_steps').insert(stepInserts);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const db = getServiceClient();
  const body = await request.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json({ error: 'id and status required' }, { status: 400 });
  }

  const { error } = await db.from('drip_campaigns').update({ status }).eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
