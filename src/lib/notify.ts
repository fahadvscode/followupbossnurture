import { sendSmtpIfConfigured } from '@/lib/email';
import { resolveTwilioWebhookOrigin } from '@/lib/twilio';
import { conversationUrl } from '@/lib/conversation-url';
import type { CampaignType } from '@/types';

/** Pull a bare email address out of values like "Jane Agent <jane@x.com>". */
function extractEmailAddress(raw: string | undefined): string {
  const v = (raw ?? '').trim();
  if (!v) return '';
  const match = v.match(/<([^>]+)>/);
  return (match ? match[1] : v).trim();
}

/** Who should receive reply alerts: REPLY_NOTIFY_EMAIL (comma-separated) → EMAIL_FROM → SMTP_USER. */
function resolveNotifyRecipients(): string {
  const explicit = process.env.REPLY_NOTIFY_EMAIL?.trim();
  if (explicit) {
    return explicit
      .split(',')
      .map((e) => extractEmailAddress(e))
      .filter(Boolean)
      .join(', ');
  }
  return extractEmailAddress(process.env.EMAIL_FROM) || extractEmailAddress(process.env.SMTP_USER);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Deep link to the SMS conversation thread (AI nurture page or contact chat panel).
 */
function buildConversationLink(args: {
  origin: string;
  contactId: string;
  campaignId?: string | null;
  campaignType?: CampaignType | string | null;
}): string {
  const { origin, contactId, campaignId, campaignType } = args;
  if (!campaignId) return `${origin}/contacts/${contactId}?chat=1`;
  return conversationUrl({
    origin,
    contactId,
    campaignId,
    campaignType: campaignType || 'standard',
  });
}

/**
 * Email the agent when a lead replies. No-op (returns false) when SMTP or a
 * recipient is not configured, so it never blocks reply handling.
 */
export async function notifyAgentOfReply(args: {
  contact: { id: string; first_name: string; last_name: string; phone: string };
  body: string;
  campaignName?: string | null;
  campaignId?: string | null;
  campaignType?: CampaignType | string | null;
  isOptOut?: boolean;
}): Promise<boolean> {
  const to = resolveNotifyRecipients();
  if (!to) return false;
  if (!process.env.SMTP_HOST?.trim()) return false;

  const name =
    `${args.contact.first_name || ''} ${args.contact.last_name || ''}`.trim() ||
    args.contact.phone ||
    'Lead';

  const origin = resolveTwilioWebhookOrigin();
  const link = origin
    ? buildConversationLink({
        origin,
        contactId: args.contact.id,
        campaignId: args.campaignId,
        campaignType: args.campaignType,
      })
    : '';

  const campaignLabel = args.campaignName || 'No active campaign';
  const subjectPrefix = args.isOptOut ? 'Opt-out' : 'New SMS reply';
  const subject = `${subjectPrefix} from ${name}`;

  const text = [
    `${name} (${args.contact.phone}) replied:`,
    '',
    args.body,
    '',
    `Campaign: ${campaignLabel}`,
    link ? `View conversation: ${link}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;">
    <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">${escapeHtml(subjectPrefix)}</p>
    <h2 style="font-size:18px;margin:0 0 12px;">${escapeHtml(name)}
      <span style="font-weight:400;color:#6b7280;">· ${escapeHtml(args.contact.phone)}</span>
    </h2>
    <div style="background:#f3f4f6;border-radius:10px;padding:14px 16px;margin:0 0 16px;">
      <p style="margin:0;font-size:15px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(args.body)}</p>
    </div>
    <p style="font-size:13px;color:#6b7280;margin:0 0 18px;">Campaign: ${escapeHtml(campaignLabel)}</p>
    ${
      link
        ? `<a href="${escapeHtml(link)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:8px;">Open conversation</a>`
        : ''
    }
  </div>`;

  try {
    return await sendSmtpIfConfigured(to, subject, text, html);
  } catch (e) {
    console.error('Failed to send reply notification email:', e);
    return false;
  }
}
