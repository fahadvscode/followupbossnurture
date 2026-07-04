import { getServiceClient } from '@/lib/supabase';

export type InboxThread = {
  id: string;
  kind: 'ai' | 'standard';
  conversation_id: string | null;
  contact_id: string;
  campaign_id: string;
  enrollment_id: string | null;
  status: string;
  needs_attention: boolean;
  exchange_count: number;
  follow_up_count: number;
  last_outbound_at: string | null;
  last_inbound_at: string | null;
  escalation_reason: string | null;
  takeover_at: string | null;
  updated_at: string | null;
  contact: { id: string; first_name: string; last_name: string; phone: string } | null;
  campaign: { id: string; name: string; campaign_type: string } | null;
  last_message: { body: string; direction: string; sent_at: string } | null;
};

type Filter = 'needs_action' | 'escalated' | 'human_takeover' | 'active' | 'all';

function lastActivity(thread: InboxThread): string {
  return thread.last_inbound_at || thread.last_outbound_at || thread.updated_at || '';
}

function matchesFilter(thread: InboxThread, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'needs_action') return thread.needs_attention || thread.status === 'escalated';
  if (filter === 'escalated') return thread.status === 'escalated';
  if (filter === 'human_takeover') return thread.status === 'human_takeover';
  if (filter === 'active') return thread.status === 'active';
  return true;
}

async function lastMessageForPair(
  db: ReturnType<typeof getServiceClient>,
  contactId: string,
  campaignId: string,
  enrollmentId?: string | null
) {
  let query = db
    .from('drip_messages')
    .select('body,direction,sent_at,created_at')
    .eq('contact_id', contactId)
    .eq('campaign_id', campaignId)
    .order('sent_at', { ascending: false })
    .limit(1);

  if (enrollmentId) {
    query = query.eq('enrollment_id', enrollmentId);
  }

  const { data } = await query.maybeSingle();
  if (!data) return null;
  return {
    body: data.body as string,
    direction: data.direction as string,
    sent_at: (data.sent_at as string) || (data.created_at as string),
  };
}

export async function loadInboxThreads(filter: Filter = 'all'): Promise<{
  threads: InboxThread[];
  needs_action_count: number;
}> {
  const db = getServiceClient();
  const threadMap = new Map<string, InboxThread>();

  const { data: aiRows } = await db
    .from('drip_ai_conversations')
    .select('*, contact:drip_contacts(id,first_name,last_name,phone), campaign:drip_campaigns(id,name,campaign_type)')
    .order('updated_at', { ascending: false })
    .limit(300);

  for (const conv of aiRows || []) {
    const contact = conv.contact as InboxThread['contact'];
    const campaign = conv.campaign as InboxThread['campaign'];
    const lastMsg = await lastMessageForPair(
      db,
      conv.contact_id as string,
      conv.campaign_id as string,
      conv.enrollment_id as string
    );

    const thread: InboxThread = {
      id: conv.id as string,
      kind: 'ai',
      conversation_id: conv.id as string,
      contact_id: conv.contact_id as string,
      campaign_id: conv.campaign_id as string,
      enrollment_id: conv.enrollment_id as string,
      status: conv.status as string,
      needs_attention: Boolean(conv.needs_attention),
      exchange_count: Number(conv.exchange_count) || 0,
      follow_up_count: Number(conv.follow_up_count) || 0,
      last_outbound_at: (conv.last_outbound_at as string) || null,
      last_inbound_at: (conv.last_inbound_at as string) || null,
      escalation_reason: (conv.escalation_reason as string) || null,
      takeover_at: (conv.takeover_at as string) || null,
      updated_at: (conv.updated_at as string) || null,
      contact,
      campaign,
      last_message: lastMsg,
    };

    threadMap.set(`${thread.contact_id}:${thread.campaign_id}`, thread);
  }

  const { data: inboundMsgs } = await db
    .from('drip_messages')
    .select('contact_id,campaign_id,enrollment_id,sent_at,created_at')
    .eq('direction', 'inbound')
    .not('campaign_id', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(500);

  const standardPairs = new Map<string, { contact_id: string; campaign_id: string; enrollment_id: string | null }>();
  for (const row of inboundMsgs || []) {
    const key = `${row.contact_id}:${row.campaign_id}`;
    if (threadMap.has(key) || standardPairs.has(key)) continue;
    standardPairs.set(key, {
      contact_id: row.contact_id as string,
      campaign_id: row.campaign_id as string,
      enrollment_id: (row.enrollment_id as string) || null,
    });
  }

  for (const pair of standardPairs.values()) {
    const { data: campaign } = await db
      .from('drip_campaigns')
      .select('id,name,campaign_type')
      .eq('id', pair.campaign_id)
      .maybeSingle();

    if (!campaign || campaign.campaign_type === 'ai_nurture') continue;

    const { data: contact } = await db
      .from('drip_contacts')
      .select('id,first_name,last_name,phone')
      .eq('id', pair.contact_id)
      .maybeSingle();

    const lastMsg = await lastMessageForPair(db, pair.contact_id, pair.campaign_id, pair.enrollment_id);
    const needsAttention = lastMsg?.direction === 'inbound';

    const thread: InboxThread = {
      id: `std-${pair.contact_id}-${pair.campaign_id}`,
      kind: 'standard',
      conversation_id: null,
      contact_id: pair.contact_id,
      campaign_id: pair.campaign_id,
      enrollment_id: pair.enrollment_id,
      status: 'replied',
      needs_attention: needsAttention,
      exchange_count: 0,
      follow_up_count: 0,
      last_outbound_at: null,
      last_inbound_at: lastMsg?.direction === 'inbound' ? lastMsg.sent_at : null,
      escalation_reason: null,
      takeover_at: null,
      updated_at: lastMsg?.sent_at || null,
      contact: contact || null,
      campaign: campaign as InboxThread['campaign'],
      last_message: lastMsg,
    };

    threadMap.set(`${pair.contact_id}:${pair.campaign_id}`, thread);
  }

  const allThreads = Array.from(threadMap.values()).sort(
    (a, b) => new Date(lastActivity(b)).getTime() - new Date(lastActivity(a)).getTime()
  );

  const needsActionCount = allThreads.filter(
    (t) => t.needs_attention || t.status === 'escalated'
  ).length;

  return {
    threads: allThreads.filter((t) => matchesFilter(t, filter)),
    needs_action_count: needsActionCount,
  };
}
