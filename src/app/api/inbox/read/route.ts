import { NextRequest, NextResponse } from 'next/server';
import { markInboxThreadRead } from '@/lib/inbox-read';

// POST /api/inbox/read — mark SMS thread as read (agent opened conversation)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const contactId = String(body.contact_id || '').trim();
  const campaignId = String(body.campaign_id || '').trim();

  if (!contactId || !campaignId) {
    return NextResponse.json({ error: 'contact_id and campaign_id required' }, { status: 400 });
  }

  await markInboxThreadRead(contactId, campaignId);
  return NextResponse.json({ ok: true });
}
