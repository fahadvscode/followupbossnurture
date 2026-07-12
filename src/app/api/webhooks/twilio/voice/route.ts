import { NextRequest, NextResponse } from 'next/server';
import {
  formDataToTwilioParams,
  validateTwilioWebhookRequest,
} from '@/lib/twilio';
import {
  buildVoiceForwardTwiml,
  resolveVoiceForwardTarget,
} from '@/lib/twilio-voice';

function twimlResponse(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: { 'Content-Type': 'text/xml' },
  });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params = formDataToTwilioParams(formData);

  if (!validateTwilioWebhookRequest(request, params)) {
    return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 403 });
  }

  const to = String(formData.get('To') || '');
  const forwardTo = resolveVoiceForwardTarget(to);

  if (!forwardTo) {
    return twimlResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">This line is not configured for calls.</Say></Response>'
    );
  }

  return twimlResponse(buildVoiceForwardTwiml(forwardTo, to));
}
