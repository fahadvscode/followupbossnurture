import { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';
import { normalizePhone } from '@/lib/utils';
import { pushEvent } from '@/lib/fub';

type Params = { params: Promise<{ id: string }> };

// POST /api/ai-conversations/[id]
// body: { action: 'reply' | 'takeover' | 'handback' | 'dismiss_attention', message?: string }
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const { action, message } = body as { action: string; message?: string };
  const db = getServiceClient();

  const { data: conv } = await db
    .from('drip_ai_conversations')
    .select('*, campaign:drip_campaigns(name,twilio_from_number)')
    .eq('id', id)
    .single();

  if (!conv) return Response.json({ error: 'Conversation not found' }, { status: 404 });

  const { data: contact } = await db
    .from('drip_contacts')
    .select('*')
    .eq('id', conv.contact_id)
    .single();

  if (!contact) return Response.json({ error: 'Contact not found' }, { status: 404 });

  const now = new Date().toISOString();
  const campRow = conv.campaign as { name?: string; twilio_from_number?: string } | null;

  // ── Take over — pause AI, human replies manually ──────────────────
  if (action === 'takeover') {
    await db
      .from('drip_ai_conversations')
      .update({ status: 'human_takeover', takeover_at: now, needs_attention: false })
      .eq('id', id);
    return Response.json({ ok: true, status: 'human_takeover' });
  }

  // ── Hand back to AI ───────────────────────────────────────────────
  if (action === 'handback') {
    await db
      .from('drip_ai_conversations')
      .update({ status: 'active', takeover_at: null })
      .eq('id', id);
    // Resume enrollment too
    await db
      .from('drip_enrollments')
      .update({ status: 'active', paused_at: null })
      .eq('id', conv.enrollment_id)
      .eq('status', 'paused');
    return Response.json({ ok: true, status: 'active' });
  }

  // ── Restart conversation (reset escalation / max-exchange limit) ─────────
  if (action === 'restart') {
    await db
      .from('drip_ai_conversations')
      .update({
        status: 'active',
        exchange_count: 0,
        follow_up_count: 0,
        needs_attention: false,
        escalation_reason: null,
        takeover_at: null,
        last_outbound_at: null,
        last_inbound_at: null,
      })
      .eq('id', id);

    await db
      .from('drip_enrollments')
      .update({ status: 'active', paused_at: null, completed_at: null })
      .eq('id', conv.enrollment_id)
      .in('status', ['paused', 'completed', 'opted_out']);

    return Response.json({ ok: true, status: 'active' });
  }

  // ── Dismiss needs_attention flag ──────────────────────────────────
  if (action === 'dismiss_attention') {
    await db
      .from('drip_ai_conversations')
      .update({ needs_attention: false })
      .eq('id', id);
    return Response.json({ ok: true });
  }

  // ── Manual reply ──────────────────────────────────────────────────
  if (action === 'reply') {
    if (!message?.trim()) return Response.json({ error: 'message required' }, { status: 400 });

    const phone = normalizePhone(contact.phone);
    if (!phone) return Response.json({ error: 'Invalid contact phone' }, { status: 400 });

    const fromNumber = campRow?.twilio_from_number || undefined;
    const result = await sendSMS(phone, message.trim(), fromNumber);

    await db.from('drip_messages').insert({
      enrollment_id: conv.enrollment_id,
      contact_id: conv.contact_id,
      campaign_id: conv.campaign_id,
      direction: 'outbound',
      body: message.trim(),
      twilio_sid: result.sid,
      status: result.status === 'queued' ? 'queued' : 'sent',
      sent_at: now,
      channel: 'sms',
    });

    await db
      .from('drip_ai_conversations')
      .update({ last_outbound_at: now, needs_attention: false })
      .eq('id', id);

    if (contact.fub_id) {
      pushEvent(contact.fub_id, {
        type: 'outgoing_sms',
        source: 'Drip Platform (Human)',
        message: `[Manual reply: ${campRow?.name || 'AI Campaign'}] ${message.trim()}`,
      }).catch(() => {});
    }

    return Response.json({ ok: true, sid: result.sid });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
}
