/**
 * Point +16475605822 at the voice-forward webhook.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/configure-twilio-voice-forward.ts
 */
import { resolveTwilioWebhookOrigin } from '../src/lib/twilio';
import {
  configureIncomingNumberVoiceWebhook,
  DEFAULT_VOICE_FORWARD_FROM,
  resolveVoiceForwardFromNumber,
} from '../src/lib/twilio-voice';

async function main() {
  const origin = resolveTwilioWebhookOrigin();
  if (!origin) {
    console.error(
      'Set TWILIO_WEBHOOK_BASE_URL or NEXT_PUBLIC_BASE_URL to your deployed app URL.'
    );
    process.exit(1);
  }

  const fromNumber = resolveVoiceForwardFromNumber();
  const voiceUrl = `${origin}/api/webhooks/twilio/voice`;
  console.log(`Configuring voice webhook for ${fromNumber} → ${voiceUrl}`);

  const updated = await configureIncomingNumberVoiceWebhook({
    phoneNumber: fromNumber,
    voiceUrl,
  });
  if (!updated) {
    console.error(
      `No Twilio incoming number found for ${fromNumber} (default ${DEFAULT_VOICE_FORWARD_FROM}).`
    );
    process.exit(1);
  }

  const forwardTo =
    process.env.TWILIO_VOICE_FORWARD_TO?.trim() || '+16478981739';
  console.log(`Done. Calls to ${updated.phoneNumber} will forward to ${forwardTo}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
