import { unsubscribeUrl } from '@/lib/unsubscribe';

export interface BusinessIdentity {
  name: string;
  address: string;
  phone: string;
  email: string;
}

/**
 * CASL / CAN-SPAM identity block — pulled from env so it can be updated
 * without a redeploy. `BUSINESS_ADDRESS` is required for compliance.
 */
export function businessIdentity(): BusinessIdentity {
  return {
    name:
      process.env.BUSINESS_NAME?.trim() ||
      'Fahad Javed — Century 21 Property Zone Realty Inc.',
    address:
      process.env.BUSINESS_ADDRESS?.trim() ||
      '600 Matheson Blvd W, Mississauga, ON L5R 4C1',
    phone: process.env.BUSINESS_PHONE?.trim() || '647-898-1739',
    email:
      process.env.BUSINESS_EMAIL?.trim() ||
      process.env.EMAIL_FROM?.trim() ||
      'info@soldbyfahad.com',
  };
}

function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Plain-text CASL footer block appended after two blank lines. */
export function plainTextFooter(contactId: string): string {
  const b = businessIdentity();
  const link = unsubscribeUrl(contactId);
  const lines = [
    '',
    '——',
    b.name,
    b.address,
    `${b.phone} · ${b.email}`,
    '',
    link
      ? `Want to stop receiving these? Unsubscribe: ${link}`
      : `Reply STOP to stop receiving these emails.`,
  ];
  return lines.join('\n');
}

/** HTML CASL footer block (matches the plain-text version visually). */
export function htmlFooter(contactId: string): string {
  const b = businessIdentity();
  const link = unsubscribeUrl(contactId);
  const styleWrap =
    'margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;line-height:1.5;';
  const linkTag = link
    ? `<a href="${esc(link)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a> from these emails`
    : 'Reply STOP to stop receiving these emails';
  return `
<div style="${styleWrap}">
  <div><strong>${esc(b.name)}</strong></div>
  <div>${esc(b.address)}</div>
  <div>${esc(b.phone)} · <a href="mailto:${esc(b.email)}" style="color:#6b7280;">${esc(b.email)}</a></div>
  <div style="margin-top:12px;">${linkTag}.</div>
</div>`.trim();
}

/** Append the CASL footer to both parts if not already present. */
export function appendCaslFooter(
  contactId: string,
  html: string,
  text: string
): { html: string; text: string } {
  const alreadyHasFooter = /unsubscribe/i.test(text) && /unsubscribe/i.test(html);
  if (alreadyHasFooter) return { html, text };

  const footerText = plainTextFooter(contactId);
  const footerHtml = htmlFooter(contactId);

  const outText = `${text.trimEnd()}\n${footerText}\n`;
  // Insert footer before </body> when present; otherwise just append.
  const outHtml = /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${footerHtml}\n</body>`)
    : `${html}\n${footerHtml}`;

  return { html: outHtml, text: outText };
}
