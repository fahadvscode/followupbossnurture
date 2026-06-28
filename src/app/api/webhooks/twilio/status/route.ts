import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { formDataToTwilioParams, validateTwilioWebhookRequest } from '@/lib/twilio';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params = formDataToTwilioParams(formData);

  if (!validateTwilioWebhookRequest(request, params)) {
    return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 403 });
  }

  const messageSid = formData.get('MessageSid') as string;
  const messageStatus = formData.get('MessageStatus') as string;
  const errorCode = formData.get('ErrorCode') as string | null;
  const errorMessage = formData.get('ErrorMessage') as string | null;

  if (!messageSid || !messageStatus) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const db = getServiceClient();

  const statusMap: Record<string, string> = {
    queued: 'queued',
    sent: 'sent',
    delivered: 'delivered',
    undelivered: 'failed',
    failed: 'failed',
  };

  const mappedStatus = statusMap[messageStatus] || messageStatus;

  const { data: row } = await db
    .from('drip_messages')
    .select('error_detail')
    .eq('twilio_sid', messageSid)
    .maybeSingle();

  const prevDetail =
    row?.error_detail && typeof row.error_detail === 'object' && !Array.isArray(row.error_detail)
      ? (row.error_detail as Record<string, unknown>)
      : {};

  const callbackLayer: Record<string, unknown> = {
    source: 'twilio',
    phase: 'status_callback',
    twilioStatus: messageStatus,
    callbackAt: new Date().toISOString(),
  };
  if (errorCode) {
    callbackLayer.errorCode = String(errorCode);
    callbackLayer.message =
      errorMessage && String(errorMessage).trim()
        ? String(errorMessage).trim()
        : `Twilio status ${messageStatus} (code ${errorCode})`;
  } else if (messageStatus === 'undelivered' || mappedStatus === 'failed') {
    callbackLayer.message = `Twilio reported ${messageStatus}`;
  }

  const updatePayload: Record<string, unknown> = { status: mappedStatus };

  if (mappedStatus === 'failed') {
    updatePayload.error_detail = { ...prevDetail, ...callbackLayer };
  } else if (mappedStatus === 'delivered') {
    updatePayload.error_detail = null;
  }

  await db.from('drip_messages').update(updatePayload).eq('twilio_sid', messageSid);

  return NextResponse.json({ ok: true });
}
