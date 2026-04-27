import nodemailer from 'nodemailer';

/** Strip wrapping quotes often pasted into Vercel env values. */
function trimSmtpCredential(raw: string | undefined): string {
  let v = (raw ?? '').trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

/** Rough plain-text fallback for multipart emails when the primary body is HTML. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function plainTextToHtml(text: string): string {
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<p>${esc.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`;
}

/**
 * Sends a real message to the lead's inbox when SMTP_* + EMAIL_FROM are set.
 * Use the same mailbox you connected in Follow Up Boss (e.g. Google Workspace + app password).
 * Returns false when SMTP is not configured (FUB marketing API still logs the send on the timeline).
 */
export async function sendSmtpIfConfigured(
  to: string,
  subject: string,
  text: string,
  html: string
): Promise<boolean> {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return false;

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = trimSmtpCredential(process.env.SMTP_USER);
  const pass = trimSmtpCredential(process.env.SMTP_PASS);
  const from = trimSmtpCredential(process.env.EMAIL_FROM);

  if (!user || !pass || !from) {
    throw new Error(
      'SMTP_HOST is set but SMTP_USER, SMTP_PASS, or EMAIL_FROM is missing'
    );
  }

  const secure = port === 465;
  const isGmail = /gmail\.com|googlemail\.com/i.test(host);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth: { user, pass },
    ...(isGmail && !secure
      ? {
          tls: {
            minVersion: 'TLSv1.2' as const,
            servername: 'smtp.gmail.com',
          },
        }
      : {}),
  });

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return true;
}
