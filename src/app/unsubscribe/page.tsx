import { getServiceClient } from '@/lib/supabase';
import { markContactOptedOut } from '@/lib/contact-opt-out';
import { verifyContactUnsubscribe } from '@/lib/unsubscribe';
import { pushEvent } from '@/lib/fub';
import { businessIdentity } from '@/lib/email-footer';

export const dynamic = 'force-dynamic';

type Search = Promise<{ c?: string; t?: string }>;

async function processUnsubscribe(
  contactId: string,
  token: string
): Promise<{ status: 'ok' | 'already' | 'invalid' | 'not_found'; label?: string }> {
  if (!contactId || !token || !verifyContactUnsubscribe(contactId, token)) {
    return { status: 'invalid' };
  }
  const db = getServiceClient();
  const { data: contact } = await db
    .from('drip_contacts')
    .select('id, phone, first_name, last_name, fub_id, opted_out, email')
    .eq('id', contactId)
    .maybeSingle();
  if (!contact) return { status: 'not_found' };

  const label = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.email || '';

  if (contact.opted_out) return { status: 'already', label };

  await markContactOptedOut(db, contact, 'EMAIL_UNSUBSCRIBE');
  if (contact.fub_id) {
    pushEvent(contact.fub_id, {
      type: 'Note',
      source: 'Drip Platform',
      message: `[Opt-out] ${label} clicked the email unsubscribe link — drips stopped.`,
    }).catch(() => {});
  }
  return { status: 'ok', label };
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const contactId = params.c || '';
  const token = params.t || '';

  const result = await processUnsubscribe(contactId, token);
  const b = businessIdentity();

  const headline =
    result.status === 'ok'
      ? "You're unsubscribed"
      : result.status === 'already'
        ? "You're already unsubscribed"
        : result.status === 'not_found'
          ? 'No matching contact'
          : 'Invalid unsubscribe link';

  const body =
    result.status === 'ok'
      ? `We've removed ${result.label || 'you'} from all automated emails and texts. If you have any questions, just reply to a previous email or call ${b.phone}.`
      : result.status === 'already'
        ? `${result.label || 'This email'} is already opted out — no further action needed.`
        : result.status === 'not_found'
          ? 'We could not find your record. Please contact us so we can remove you.'
          : 'This link is invalid or has expired. Please email us to be unsubscribed.';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb',
        padding: '32px 16px',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: '100%',
          background: 'white',
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          padding: 32,
        }}
      >
        <h1 style={{ fontSize: 22, marginBottom: 12, color: '#111827' }}>{headline}</h1>
        <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.6 }}>{body}</p>
        <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
        <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
          <div>
            <strong>{b.name}</strong>
          </div>
          <div>{b.address}</div>
          <div>
            {b.phone} · <a style={{ color: '#6b7280' }} href={`mailto:${b.email}`}>{b.email}</a>
          </div>
        </div>
      </div>
    </div>
  );
}
