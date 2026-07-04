import type { InboxThread } from '@/lib/inbox-threads';

/** Match inbox threads by lead name, phone, email, campaign, or any SMS body. */
export function threadMatchesInboxSearch(
  thread: InboxThread,
  query: string,
  messageBodies?: string[]
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const c = thread.contact;
  const fullName = `${c?.first_name || ''} ${c?.last_name || ''}`.trim().toLowerCase();
  const email = (c?.email || '').toLowerCase();
  const phone = (c?.phone || '').replace(/\D/g, '');
  const qDigits = q.replace(/\D/g, '');

  if (fullName && fullName.includes(q)) return true;
  if (c?.first_name?.toLowerCase().includes(q)) return true;
  if (c?.last_name?.toLowerCase().includes(q)) return true;
  if (email && email.includes(q)) return true;
  if (qDigits.length >= 3 && phone && phone.includes(qDigits)) return true;
  if (thread.campaign?.name?.toLowerCase().includes(q)) return true;
  if (thread.last_message?.body.toLowerCase().includes(q)) return true;
  if (messageBodies?.some((b) => b.toLowerCase().includes(q))) return true;

  return false;
}
