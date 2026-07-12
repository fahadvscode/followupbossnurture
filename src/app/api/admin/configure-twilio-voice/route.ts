import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE } from '@/lib/auth';
import { isValidSessionCookie } from '@/lib/auth-session';
import { resolveTwilioWebhookOrigin } from '@/lib/twilio';
import {
  configureIncomingNumberVoiceWebhook,
  resolveVoiceForwardFromNumber,
} from '@/lib/twilio-voice';

async function authorize(request: NextRequest): Promise<boolean> {
  if (process.env.NODE_ENV === 'development') return true;

  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get('authorization')?.trim();
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  const session = request.cookies.get(AUTH_COOKIE)?.value;
  return isValidSessionCookie(session);
}

/** Wire +16475605822 voice URL in Twilio (uses production env credentials). */
export async function POST(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const origin = resolveTwilioWebhookOrigin();
  if (!origin) {
    return NextResponse.json(
      { error: 'Missing TWILIO_WEBHOOK_BASE_URL or NEXT_PUBLIC_BASE_URL' },
      { status: 500 }
    );
  }

  const fromNumber = resolveVoiceForwardFromNumber();
  const voiceUrl = `${origin}/api/webhooks/twilio/voice`;

  try {
    const updated = await configureIncomingNumberVoiceWebhook({
      phoneNumber: fromNumber,
      voiceUrl,
    });

    if (!updated) {
      return NextResponse.json(
        { error: `No Twilio incoming number found for ${fromNumber}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      phoneNumber: updated.phoneNumber,
      voiceUrl,
      forwardTo: process.env.TWILIO_VOICE_FORWARD_TO?.trim() || '+16478981739',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Twilio error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
