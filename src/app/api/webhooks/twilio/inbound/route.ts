import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { isOptOut } from '@/lib/twilio';
import { pushEvent } from '@/lib/fub';
import { normalizePhone } from '@/lib/utils';
import { handleAiReply } from '@/lib/ai-engine';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
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
      .single();

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
    .select('*, campaign:drip_campaigns(name, campaign_type)')
    .eq('contact_id', contact.id)
    .eq('status', 'active')
    .order('enrolled_at', { ascending: false });

  const activeList = activeRows || [];
  /** Link inbound row to the newest active enrollment for display; all actives are paused below. */
  const primary = activeList[0];

  await db.from('drip_messages').insert({
    enrollment_id: primary?.id || null,
    contact_id: contact.id,
    campaign_id: primary?.campaign_id || null,
    step_number: primary?.current_step ?? null,
    direction: 'inbound',
    body,
    twilio_sid: messageSid,
    status: 'received',
    sent_at: new Date().toISOString(),
  });

  // ── AI nurture: auto-reply instead of pausing ──────────────────────
  const aiHandled: string[] = [];
  if (activeList.length > 0 && process.env.DEEPSEEK_API_KEY?.trim() && !isOptOut(body)) {
    for (const enrollment of activeList) {
      const campRow = enrollment.campaign as { name?: string; campaign_type?: string } | null;
      if (campRow?.campaign_type === 'ai_nurture') {
        try {
          await handleAiReply({
            enrollmentId: enrollment.id,
            contactId: contact.id,
            campaignId: enrollment.campaign_id,
            contact: contact as Parameters<typeof handleAiReply>[0]['contact'],
            inboundBody: body,
          });
          aiHandled.push(enrollment.id);
        } catch (e) {
          console.error('AI reply failed for enrollment', enrollment.id, e);
        }
      }
    }
  }

  // Pause only non-AI (standard) enrollments on reply
  const standardToUpdate = activeList.filter(
    (e) => !aiHandled.includes(e.id)
  );
  if (standardToUpdate.length > 0) {
    const now = new Date().toISOString();
    await db
      .from('drip_enrollments')
      .update({ status: 'paused', paused_at: now })
      .eq('contact_id', contact.id)
      .eq('status', 'active')
      .not('id', 'in', `(${aiHandled.join(',')})`);
  }

  if (isOptOut(body)) {
    await db
      .from('drip_contacts')
      .update({ opted_out: true })
      .eq('id', contact.id);

    await db
      .from('drip_enrollments')
      .update({ status: 'opted_out' })
      .eq('contact_id', contact.id)
      .in('status', ['active', 'paused']);

    await db.from('drip_opt_outs').insert({
      contact_id: contact.id,
      phone: contact.phone,
      reason: body.trim().toUpperCase(),
    });
  }

  if (contact.fub_id) {
    const names = activeList
      .map((row) => (row.campaign as { name?: string } | null)?.name)
      .filter(Boolean) as string[];
    const campaignLabel =
      names.length === 0
        ? null
        : names.length === 1
          ? names[0]
          : `${names.length} campaigns`;

    const replyLabel = campaignLabel
      ? `[SMS Reply · paused: ${campaignLabel}]`
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

  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { 'Content-Type': 'text/xml' } }
  );
}
