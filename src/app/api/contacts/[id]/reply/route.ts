import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';
import { normalizePhone } from '@/lib/utils';
import { pushEvent } from '@/lib/fub';

type Params = { params: Promise<{ id: string }> };

// POST /api/contacts/[id]/reply — manual SMS reply for standard drip campaigns
export async function POST(request: NextRequest, { params }: Params) {
  const { id: contactId } = await params;
  const body = await request.json();
  const campaignId = String(body.campaign_id || '').trim();
  const message = String(body.message || '').trim();

  if (!campaignId) {
    return NextResponse.json({ error: 'campaign_id required' }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: 'message required' }, { status: 400 });
  }

  const db = getServiceClient();

  const [{ data: contact }, { data: campaign }] = await Promise.all([
    db.from('drip_contacts').select('*').eq('id', contactId).single(),
    db.from('drip_campaigns').select('*').eq('id', campaignId).single(),
  ]);

  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (campaign.campaign_type === 'ai_nurture') {
    return NextResponse.json(
      { error: 'Use the AI conversation view to reply to AI nurture campaigns' },
      { status: 400 }
    );
  }

  const phone = normalizePhone(contact.phone);
  if (!phone) return NextResponse.json({ error: 'Invalid contact phone' }, { status: 400 });

  const { data: enrollment } = await db
    .from('drip_enrollments')
    .select('id')
    .eq('contact_id', contactId)
    .eq('campaign_id', campaignId)
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();
  const fromNumber = campaign.twilio_from_number || undefined;
  const result = await sendSMS(phone, message, fromNumber);

  await db.from('drip_messages').insert({
    enrollment_id: enrollment?.id || null,
    contact_id: contactId,
    campaign_id: campaignId,
    direction: 'outbound',
    body: message,
    twilio_sid: result.sid,
    status: result.status === 'queued' ? 'queued' : 'sent',
    sent_at: now,
    channel: 'sms',
  });

  if (contact.fub_id) {
    pushEvent(contact.fub_id, {
      type: 'outgoing_sms',
      source: 'Drip Platform (Human)',
      message: `[Manual reply: ${campaign.name}] ${message}`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, sid: result.sid });
}
