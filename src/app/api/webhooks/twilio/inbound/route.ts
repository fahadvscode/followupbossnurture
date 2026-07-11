import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { formDataToTwilioParams, isOptOut, validateTwilioWebhookRequest } from '@/lib/twilio';
import { pushEvent } from '@/lib/fub';
import { tagLeadRepliedInFub } from '@/lib/fub-replied-tag';
import { normalizePhone } from '@/lib/utils';
import { handleAiReply } from '@/lib/ai-engine';
import { findAttributionEnrollment } from '@/lib/inbox-messages';
import { markContactOptedOut } from '@/lib/contact-opt-out';
import { notifyAgentOfReply } from '@/lib/notify';

function unwrapOne<T>(row: T | T[] | null | undefined): T | null {
  if (row == null) return null;
  return Array.isArray(row) ? (row[0] ?? null) : row;
}

type CampaignPauseRow = {
  name?: string;
  campaign_type?: string;
  pause_on_sms_reply?: boolean | null;
};

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params = formDataToTwilioParams(formData);

  if (!validateTwilioWebhookRequest(request, params)) {
    return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 403 });
  }

  const from = formData.get('From') as string;
  const body = formData.get('Body') as string;
  const messageSid = formData.get('MessageSid') as string;

  const db = getServiceClient();
  const normalized = normalizePhone(from);

  const { data: contact } = await db
    .from('drip_contacts')
    .select('*')
    .eq('phone', normalized)
    .single();

  if (!contact) {
    const { data: contactAlt } = await db
      .from('drip_contacts')
      .select('*')
      .ilike('phone', `%${from.replace(/\D/g, '').slice(-10)}%`)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!contactAlt) {
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    return handleReply(db, contactAlt, body, messageSid);
  }

  return handleReply(db, contact, body, messageSid);
}

async function handleReply(
  db: ReturnType<typeof getServiceClient>,
  contact: { id: string; fub_id: number | null; first_name: string; last_name: string; phone: string },
  body: string,
  messageSid: string
) {
  const { data: activeRows } = await db
    .from('drip_enrollments')
    .select('*, campaign:drip_campaigns(name, campaign_type, pause_on_sms_reply)')
    .eq('contact_id', contact.id)
    .eq('status', 'active')
    .order('enrolled_at', { ascending: false });

  let activeList = activeRows || [];

  // Self-heal: if the lead has no active enrollment but has a paused AI nurture enrollment,
  // reactivate it — it was likely paused by a previous reply-handling error.
  if (activeList.length === 0) {
    const { data: pausedAi } = await db
      .from('drip_enrollments')
      .select('*, campaign:drip_campaigns(name, campaign_type, pause_on_sms_reply)')
      .eq('contact_id', contact.id)
      .eq('status', 'paused')
      .order('enrolled_at', { ascending: false });

    const aiPaused = (pausedAi || []).filter(
      (e) => unwrapOne(e.campaign as CampaignPauseRow | CampaignPauseRow[] | null)?.campaign_type === 'ai_nurture'
    );

    if (aiPaused.length > 0) {
      await db
        .from('drip_enrollments')
        .update({ status: 'active', paused_at: null })
        .in('id', aiPaused.map((e) => e.id));

      activeList = aiPaused.map((e) => ({ ...e, status: 'active' }));
      console.log(`Self-healed ${aiPaused.length} paused AI nurture enrollment(s) for contact ${contact.id}`);
    }
  }
  /** Link inbound row to the newest active enrollment for display; all actives are paused below. */
  const activePrimary = activeList[0];
  let messageEnrollmentId = activePrimary?.id ?? null;
  let messageCampaignId = activePrimary?.campaign_id ?? null;
  let messageStep = activePrimary?.current_step ?? null;

  if (!messageCampaignId) {
    const attributed = await findAttributionEnrollment(db, contact.id);
    if (attributed) {
      messageEnrollmentId = attributed.id;
      messageCampaignId = attributed.campaign_id;
      messageStep = attributed.current_step;
    }
  }

  await db.from('drip_messages').insert({
    enrollment_id: messageEnrollmentId,
    contact_id: contact.id,
    campaign_id: messageCampaignId,
    step_number: messageStep,
    direction: 'inbound',
    body,
    twilio_sid: messageSid,
    status: 'received',
    sent_at: new Date().toISOString(),
    channel: 'sms',
  });

  // ── AI nurture: auto-reply instead of pausing ──────────────────────
  const aiHandled: string[] = [];
  const primaryCamp = unwrapOne(activePrimary?.campaign as CampaignPauseRow | CampaignPauseRow[] | null);
  const primaryIsAiNurture = primaryCamp?.campaign_type === 'ai_nurture';

  if (activeList.length > 0 && !isOptOut(body)) {
    for (const enrollment of activeList) {
      const campRow = unwrapOne(enrollment.campaign as CampaignPauseRow | CampaignPauseRow[] | null);
      if (campRow?.campaign_type === 'ai_nurture') {
        // Always mark AI enrollments as "handled" so they are NEVER paused,
        // even if the reply fails — pausing an AI nurture enrollment silences it permanently.
        aiHandled.push(enrollment.id);
        if (!process.env.DEEPSEEK_API_KEY?.trim()) {
          console.warn('DEEPSEEK_API_KEY not set — skipping AI reply for enrollment', enrollment.id);
          continue;
        }
        // Inbound rows are attributed to `primary` only. When that enrollment is AI nurture,
        // generate a single reply for that thread — otherwise multiple AI campaigns would each
        // text the lead once per inbound (duplicate/confusing messages).
        if (primaryIsAiNurture && activePrimary && enrollment.id !== activePrimary.id) {
          continue;
        }
        try {
          await handleAiReply({
            enrollmentId: enrollment.id,
            contactId: contact.id,
            campaignId: enrollment.campaign_id,
            contact: contact as Parameters<typeof handleAiReply>[0]['contact'],
            inboundBody: body,
          });
        } catch (e) {
          console.error('AI reply failed for enrollment', enrollment.id, e);
        }
      }
    }
  }

  // Pause standard enrollments on SMS reply when the campaign has "stop on reply" enabled
  const standardToUpdate = activeList.filter((e) => !aiHandled.includes(e.id));
  const toPause = standardToUpdate.filter((e) => {
    const camp = unwrapOne(e.campaign as CampaignPauseRow | CampaignPauseRow[] | null);
    return camp?.pause_on_sms_reply !== false;
  });

  if (toPause.length > 0 && !isOptOut(body)) {
    const now = new Date().toISOString();
    const { error: pauseErr } = await db
      .from('drip_enrollments')
      .update({ status: 'paused', paused_at: now })
      .in(
        'id',
        toPause.map((e) => e.id)
      );
    if (pauseErr) {
      console.error('Failed to pause enrollments on SMS reply:', pauseErr);
    } else {
      console.log(
        `Paused ${toPause.length} enrollment(s) for contact ${contact.id} after SMS reply`
      );
    }
  } else if (standardToUpdate.length > 0 && !isOptOut(body)) {
    console.log(
      `SMS reply from contact ${contact.id}: ${standardToUpdate.length} active enrollment(s) keep running (pause_on_sms_reply off)`
    );
  }

  if (isOptOut(body)) {
    await markContactOptedOut(db, contact, body.trim().toUpperCase());
  }

  if (contact.fub_id) {
    void tagLeadRepliedInFub(db, contact).catch((e) =>
      console.error('Failed to add replied tag in FUB:', e)
    );

    const names = toPause
      .map((row) => unwrapOne(row.campaign as CampaignPauseRow | CampaignPauseRow[] | null)?.name)
      .filter(Boolean) as string[];
    const campaignLabel =
      names.length === 0
        ? null
        : names.length === 1
          ? names[0]
          : `${names.length} campaigns`;

    const replyLabel = campaignLabel
      ? `[SMS Reply · paused: ${campaignLabel}]`
      : activeList.length > 0 && !isOptOut(body)
        ? '[SMS Reply · drip continues]'
        : '[SMS Reply]';

    pushEvent(contact.fub_id, {
      type: 'incoming_sms',
      source: 'Drip Platform',
      message: `${replyLabel} From ${contact.first_name || ''} ${contact.last_name || ''} (${contact.phone}): ${body}`,
    }).catch((e) => console.error('Failed to push reply to FUB:', e));

    if (isOptOut(body)) {
      pushEvent(contact.fub_id, {
        type: 'Note',
        source: 'Drip Platform',
        message: `[Opt-out] ${contact.first_name || ''} ${contact.last_name || ''} replied "${body.trim()}" and has been opted out of all drip campaigns.`,
      }).catch((e) => console.error('Failed to push opt-out event to FUB:', e));
    }
  }

  const notifyCampaignName =
    primaryCamp?.name ||
    (activeList
      .map((row) => unwrapOne(row.campaign as CampaignPauseRow | CampaignPauseRow[] | null)?.name)
      .filter(Boolean)[0] as string | undefined) ||
    null;

  const aiEnrollment = activeList.find(
    (e) => unwrapOne(e.campaign as CampaignPauseRow | CampaignPauseRow[] | null)?.campaign_type === 'ai_nurture'
  );
  const linkEnrollment = aiEnrollment || activePrimary;
  const linkCamp = unwrapOne(linkEnrollment?.campaign as CampaignPauseRow | CampaignPauseRow[] | null);

  void notifyAgentOfReply({
    contact: {
      id: contact.id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      phone: contact.phone,
    },
    body,
    campaignName: linkCamp?.name || notifyCampaignName,
    campaignId: linkEnrollment?.campaign_id ?? messageCampaignId,
    campaignType: linkCamp?.campaign_type || 'standard',
    isOptOut: isOptOut(body),
  }).catch((e) => console.error('Reply notification error:', e));

  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { 'Content-Type': 'text/xml' } }
  );
}
