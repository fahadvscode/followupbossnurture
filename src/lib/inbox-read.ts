import { getServiceClient } from '@/lib/supabase';

export type InboxReadRow = {
  contact_id: string;
  campaign_id: string;
  last_read_at: string;
};

/** Thread is unread when the lead's latest inbound SMS is newer than last open. */
export function isThreadUnread(args: {
  last_inbound_at: string | null;
  last_message: { direction: string; sent_at: string } | null;
  last_read_at: string | null | undefined;
}): boolean {
  const { last_inbound_at, last_message, last_read_at } = args;
  if (!last_inbound_at || !last_message || last_message.direction !== 'inbound') {
    return false;
  }
  if (!last_read_at) return true;
  return new Date(last_inbound_at) > new Date(last_read_at);
}

export async function loadInboxReadMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const db = getServiceClient();
    const { data, error } = await db.from('drip_inbox_read_state').select('contact_id,campaign_id,last_read_at');
    if (error) return map;
    for (const row of data || []) {
      map.set(`${row.contact_id}:${row.campaign_id}`, row.last_read_at as string);
    }
  } catch {
    /* table may not exist yet */
  }
  return map;
}

export async function markInboxThreadRead(contactId: string, campaignId: string): Promise<void> {
  const now = new Date().toISOString();
  const db = getServiceClient();

  try {
    await db.from('drip_inbox_read_state').upsert(
      {
        contact_id: contactId,
        campaign_id: campaignId,
        last_read_at: now,
      },
      { onConflict: 'contact_id,campaign_id' }
    );
  } catch {
    /* table may not exist yet */
  }

  // Clear AI needs_attention when the thread is opened
  await db
    .from('drip_ai_conversations')
    .update({ needs_attention: false })
    .eq('contact_id', contactId)
    .eq('campaign_id', campaignId);
}
