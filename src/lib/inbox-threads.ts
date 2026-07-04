import { getServiceClient } from '@/lib/supabase';
import { isSmsMessage } from '@/lib/delivery-error-meta';
import { isThreadUnread, loadInboxReadMap } from '@/lib/inbox-read';

export type InboxThread = {
  id: string;
  kind: 'ai' | 'standard';
  conversation_id: string | null;
  contact_id: string;
  campaign_id: string;
  enrollment_id: string | null;
  status: string;
  needs_attention: boolean;
  unread: boolean;
  message_count: number;
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

type Filter = 'unread' | 'needs_action' | 'escalated' | 'human_takeover' | 'active' | 'all';

type MsgRow = {
  contact_id: string;
  campaign_id: string | null;
  enrollment_id: string | null;
  direction: string;
  body: string;
  sent_at: string | null;
  created_at: string;
  channel: string | null;
  twilio_sid: string | null;
};

function msgTime(m: MsgRow): string {
  return m.sent_at || m.created_at;
}

function lastActivity(thread: InboxThread): string {
  return (
    thread.last_inbound_at ||
    thread.last_outbound_at ||
    thread.last_message?.sent_at ||
    thread.updated_at ||
    ''
  );
}

function matchesFilter(thread: InboxThread, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'unread') return thread.unread;
  if (filter === 'needs_action') return thread.needs_attention || thread.status === 'escalated';
  if (filter === 'escalated') return thread.status === 'escalated';
  if (filter === 'human_takeover') return thread.status === 'human_takeover';
  if (filter === 'active') return thread.status === 'active';
  return true;
}

export async function loadInboxThreads(
  filter: Filter = 'unread',
  focusContactId?: string | null
): Promise<{
  threads: InboxThread[];
  needs_action_count: number;
  unread_count: number;
}> {
  const db = getServiceClient();
  const threadMap = new Map<string, InboxThread>();
  const readMap = await loadInboxReadMap();

  const { data: messages } = await db
    .from('drip_messages')
    .select('contact_id,campaign_id,enrollment_id,direction,body,sent_at,created_at,channel,twilio_sid')
    .order('created_at', { ascending: false })
    .limit(5000);

  const smsMessages = ((messages || []) as MsgRow[]).filter(isSmsMessage);

  const enrollmentIds = [
    ...new Set(
      smsMessages
        .filter((m) => !m.campaign_id && m.enrollment_id)
        .map((m) => m.enrollment_id as string)
    ),
  ];

  const enrollmentCampaign = new Map<string, string>();
  if (enrollmentIds.length > 0) {
    const { data: enrollments } = await db
      .from('drip_enrollments')
      .select('id,campaign_id')
      .in('id', enrollmentIds);
    for (const e of enrollments || []) {
      if (e.campaign_id) enrollmentCampaign.set(e.id as string, e.campaign_id as string);
    }
  }

  const contactIds = new Set<string>();
  const campaignIds = new Set<string>();

  for (const msg of smsMessages) {
    const campaignId = msg.campaign_id || (msg.enrollment_id ? enrollmentCampaign.get(msg.enrollment_id) : null);
    if (!campaignId || !msg.contact_id) continue;

    contactIds.add(msg.contact_id);
    campaignIds.add(campaignId);

    const key = `${msg.contact_id}:${campaignId}`;
    const at = msgTime(msg);
    const preview = { body: msg.body, direction: msg.direction, sent_at: at };

    const existing = threadMap.get(key);
    if (!existing) {
      threadMap.set(key, {
        id: `msg-${msg.contact_id}-${campaignId}`,
        kind: 'standard',
        conversation_id: null,
        contact_id: msg.contact_id,
        campaign_id: campaignId,
        enrollment_id: msg.enrollment_id,
        status: 'active',
        needs_attention: msg.direction === 'inbound',
        unread: false,
        message_count: 1,
        exchange_count: 0,
        follow_up_count: 0,
        last_outbound_at: msg.direction === 'outbound' ? at : null,
        last_inbound_at: msg.direction === 'inbound' ? at : null,
        escalation_reason: null,
        takeover_at: null,
        updated_at: at,
        contact: null,
        campaign: null,
        last_message: preview,
      });
      continue;
    }

    existing.message_count += 1;
    if (msg.direction === 'inbound') {
      const inboundAt = existing.last_inbound_at;
      if (!inboundAt || new Date(at) > new Date(inboundAt)) {
        existing.last_inbound_at = at;
      }
    }
    if (msg.direction === 'outbound') {
      const outboundAt = existing.last_outbound_at;
      if (!outboundAt || new Date(at) > new Date(outboundAt)) {
        existing.last_outbound_at = at;
      }
    }
    if (!existing.last_message || new Date(at) > new Date(existing.last_message.sent_at)) {
      existing.last_message = preview;
      existing.updated_at = at;
      existing.needs_attention = msg.direction === 'inbound';
    }
  }

  const { data: aiRows } = await db
    .from('drip_ai_conversations')
    .select('*, contact:drip_contacts(id,first_name,last_name,phone), campaign:drip_campaigns(id,name,campaign_type)')
    .order('updated_at', { ascending: false })
    .limit(500);

  for (const conv of aiRows || []) {
    contactIds.add(conv.contact_id as string);
    campaignIds.add(conv.campaign_id as string);

    const key = `${conv.contact_id}:${conv.campaign_id}`;
    const contact = conv.contact as InboxThread['contact'];
    const campaign = conv.campaign as InboxThread['campaign'];
    const existing = threadMap.get(key);

    const aiMeta = {
      id: (conv.id as string) || existing?.id || `msg-${key}`,
      kind: 'ai' as const,
      conversation_id: conv.id as string,
      status: conv.status as string,
      needs_attention: Boolean(conv.needs_attention) || existing?.needs_attention || false,
      exchange_count: Number(conv.exchange_count) || 0,
      follow_up_count: Number(conv.follow_up_count) || 0,
      last_outbound_at: (conv.last_outbound_at as string) || existing?.last_outbound_at || null,
      last_inbound_at: (conv.last_inbound_at as string) || existing?.last_inbound_at || null,
      escalation_reason: (conv.escalation_reason as string) || null,
      takeover_at: (conv.takeover_at as string) || null,
      updated_at: (conv.updated_at as string) || existing?.updated_at || null,
      contact,
      campaign,
    };

    if (existing) {
      threadMap.set(key, {
        ...existing,
        ...aiMeta,
        message_count: existing.message_count,
        last_message: existing.last_message,
        needs_attention:
          Boolean(conv.needs_attention) ||
          conv.status === 'escalated' ||
          existing.last_message?.direction === 'inbound',
      });
    }
    // Skip AI conversations with no SMS messages — inbox is SMS-only
  }

  const missingContactIds = [...contactIds].filter((id) =>
    [...threadMap.values()].some((t) => t.contact_id === id && !t.contact)
  );
  const missingCampaignIds = [...campaignIds].filter((id) =>
    [...threadMap.values()].some((t) => t.campaign_id === id && !t.campaign)
  );

  const contactMap = new Map<string, InboxThread['contact']>();
  if (missingContactIds.length > 0) {
    const { data: contacts } = await db
      .from('drip_contacts')
      .select('id,first_name,last_name,phone')
      .in('id', missingContactIds);
    for (const c of contacts || []) {
      contactMap.set(c.id as string, c as InboxThread['contact']);
    }
  }

  const campaignMap = new Map<string, InboxThread['campaign']>();
  if (missingCampaignIds.length > 0) {
    const { data: campaigns } = await db
      .from('drip_campaigns')
      .select('id,name,campaign_type')
      .in('id', missingCampaignIds);
    for (const c of campaigns || []) {
      campaignMap.set(c.id as string, c as InboxThread['campaign']);
    }
  }

  for (const thread of threadMap.values()) {
    if (!thread.contact) thread.contact = contactMap.get(thread.contact_id) || null;
    if (!thread.campaign) thread.campaign = campaignMap.get(thread.campaign_id) || null;
    if (thread.kind === 'standard' && thread.campaign?.campaign_type === 'ai_nurture') {
      thread.kind = 'ai';
    }
    const key = `${thread.contact_id}:${thread.campaign_id}`;
    thread.unread = isThreadUnread({
      last_inbound_at: thread.last_inbound_at,
      last_message: thread.last_message,
      last_read_at: readMap.get(key),
    });
    if (thread.unread) {
      thread.needs_attention = true;
    }
  }

  let allThreads = Array.from(threadMap.values())
    .filter((t) => t.message_count > 0 && t.last_message)
    .sort(
    (a, b) => new Date(lastActivity(b)).getTime() - new Date(lastActivity(a)).getTime()
  );

  if (focusContactId) {
    allThreads = allThreads.filter((t) => t.contact_id === focusContactId);
  }

  const needsActionCount = allThreads.filter(
    (t) => t.needs_attention || t.status === 'escalated'
  ).length;

  const unreadCount = allThreads.filter((t) => t.unread).length;

  return {
    threads: allThreads.filter((t) => matchesFilter(t, filter)),
    needs_action_count: needsActionCount,
    unread_count: unreadCount,
  };
}
