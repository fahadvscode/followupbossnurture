import { getServiceClient } from '@/lib/supabase';
import { fetchAllPages } from '@/lib/supabase-fetch-all';
import { isSmsMessage } from '@/lib/delivery-error-meta';
import { buildMessageCampaignResolver } from '@/lib/inbox-messages';
import { isThreadUnread, loadInboxReadMap } from '@/lib/inbox-read';
import { threadMatchesInboxSearch } from '@/lib/inbox-search';

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
  /** Lead has sent at least one inbound SMS in this thread. */
  lead_has_replied: boolean;
  message_count: number;
  exchange_count: number;
  follow_up_count: number;
  last_outbound_at: string | null;
  last_inbound_at: string | null;
  escalation_reason: string | null;
  takeover_at: string | null;
  updated_at: string | null;
  contact: { id: string; first_name: string; last_name: string; phone: string; email: string | null } | null;
  campaign: { id: string; name: string; campaign_type: string } | null;
  last_message: { body: string; direction: string; sent_at: string } | null;
};

type Filter = 'unread' | 'needs_action' | 'escalated' | 'human_takeover' | 'active' | 'all';

type MsgRow = {
  id: string;
  contact_id: string;
  campaign_id: string | null;
  enrollment_id: string | null;
  direction: string;
  body?: string | null;
  sent_at: string | null;
  created_at: string;
  channel: string | null;
  twilio_sid: string | null;
};

const MESSAGE_COLUMNS =
  'id,contact_id,campaign_id,enrollment_id,direction,body,sent_at,created_at,channel,twilio_sid';
const SLIM_COLUMNS =
  'id,contact_id,campaign_id,enrollment_id,direction,sent_at,created_at,channel,twilio_sid';

/** Threads with a text in this window always show. Older no-reply drips stay out of the list. */
const RECENT_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;
const RECENT_SLICE_DAYS = [14, 30, 60];
const CONTACT_IN_CHUNK = 80;

function chunkIds(ids: string[], size = 200): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  return chunks;
}

function recentSlices(now = Date.now()): { gte: string; lt?: string }[] {
  const slices: { gte: string; lt?: string }[] = [];
  let newerEdge: number | null = null;
  for (const days of RECENT_SLICE_DAYS) {
    const olderEdge = now - days * 24 * 60 * 60 * 1000;
    slices.push({
      gte: new Date(olderEdge).toISOString(),
      ...(newerEdge != null ? { lt: new Date(newerEdge).toISOString() } : {}),
    });
    newerEdge = olderEdge;
  }
  return slices;
}

function smsQuery<T extends { or: (filters: string) => T }>(query: T): T {
  return query.or('channel.eq.sms,channel.is.null');
}

async function fetchOlderMessages(
  db: ReturnType<typeof getServiceClient>,
  contactIds: string[],
  before: string
): Promise<MsgRow[]> {
  const unique = [...new Set(contactIds)];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += CONTACT_IN_CHUNK) {
    chunks.push(unique.slice(i, i + CONTACT_IN_CHUNK));
  }

  const pages = await Promise.all(
    chunks.map((chunk) =>
      fetchAllPages<MsgRow>((range) =>
        smsQuery(
          db
            .from('drip_messages')
            .select(SLIM_COLUMNS)
            .in('contact_id', chunk)
            .lt('created_at', before)
        )
          .order('created_at', { ascending: false })
          .range(range.from, range.to)
      )
    )
  );

  return pages.flat();
}

async function loadContacts(
  db: ReturnType<typeof getServiceClient>,
  ids: string[]
): Promise<Map<string, InboxThread['contact']>> {
  const contactMap = new Map<string, InboxThread['contact']>();
  await Promise.all(
    chunkIds(ids).map(async (chunk) => {
      const { data, error } = await db
        .from('drip_contacts')
        .select('id,first_name,last_name,phone,email')
        .in('id', chunk);
      if (error) {
        console.error('inbox contact load failed:', error.message);
        return;
      }
      for (const contact of data || []) {
        contactMap.set(contact.id as string, contact as InboxThread['contact']);
      }
    })
  );
  return contactMap;
}

async function loadCampaigns(
  db: ReturnType<typeof getServiceClient>
): Promise<Map<string, InboxThread['campaign']>> {
  const campaignMap = new Map<string, InboxThread['campaign']>();
  const rows = await fetchAllPages<InboxThread['campaign']>((range) =>
    db
      .from('drip_campaigns')
      .select('id,name,campaign_type')
      .order('id', { ascending: true })
      .range(range.from, range.to)
  );
  for (const campaign of rows) {
    if (campaign?.id) campaignMap.set(campaign.id, campaign);
  }
  return campaignMap;
}

/** Latest-message previews for rows we loaded without a body. */
async function attachLatestBodies(
  db: ReturnType<typeof getServiceClient>,
  messages: MsgRow[]
): Promise<void> {
  const latest = new Map<string, MsgRow>();
  for (const msg of messages) {
    if (!msg.contact_id) continue;
    const key = `${msg.contact_id}:${msg.campaign_id || ''}`;
    const at = msg.sent_at || msg.created_at;
    const prev = latest.get(key);
    if (!prev || at > (prev.sent_at || prev.created_at)) latest.set(key, msg);
  }

  const missing = [...latest.values()].filter((msg) => msg.body == null);
  if (missing.length === 0) return;

  const bodies = new Map<string, string>();
  await Promise.all(
    chunkIds(
      missing.map((msg) => msg.id),
      200
    ).map(async (chunk) => {
      const { data, error } = await db.from('drip_messages').select('id,body').in('id', chunk);
      if (error) {
        console.error('inbox preview load failed:', error.message);
        return;
      }
      for (const row of data || []) bodies.set(row.id as string, (row.body as string) || '');
    })
  );

  for (const msg of missing) {
    if (bodies.has(msg.id)) msg.body = bodies.get(msg.id) ?? '';
  }
}

function msgTime(m: MsgRow): string {
  return m.sent_at || m.created_at;
}

/** Most recent message in the thread — inbound or outbound — for list ordering. */
function lastActivity(thread: InboxThread): string {
  if (thread.last_message?.sent_at) return thread.last_message.sent_at;

  const times = [thread.last_inbound_at, thread.last_outbound_at, thread.updated_at].filter(
    Boolean
  ) as string[];
  if (times.length === 0) return '';

  return times.reduce((latest, ts) => (new Date(ts) > new Date(latest) ? ts : latest));
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

type InboxPayload = {
  threads: InboxThread[];
  needs_action_count: number;
  unread_count: number;
};

let inboxCache: { at: number; payload: InboxPayload } | null = null;
let inboxInflight: Promise<InboxPayload> | null = null;
const INBOX_CACHE_MS = 12_000;

async function loadInboxThreadsNow(
  filter: Filter = 'all',
  focusContactId?: string | null,
  searchQuery?: string | null
): Promise<{
  threads: InboxThread[];
  needs_action_count: number;
  unread_count: number;
}> {
  const db = getServiceClient();
  const threadMap = new Map<string, InboxThread>();
  const search = (searchQuery || '').trim();
  const since = new Date(Date.now() - RECENT_WINDOW_MS).toISOString();

  const [recentPages, inbound, readMap, campaignMap, aiRows] = await Promise.all([
    Promise.all(
      recentSlices().map((slice) =>
        fetchAllPages<MsgRow>((range) => {
          let query = db.from('drip_messages').select(MESSAGE_COLUMNS).gte('created_at', slice.gte);
          if (slice.lt) query = query.lt('created_at', slice.lt);
          return smsQuery(query).order('created_at', { ascending: false }).range(range.from, range.to);
        })
      )
    ),
    fetchAllPages<MsgRow>((range) =>
      db
        .from('drip_messages')
        .select(MESSAGE_COLUMNS)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .range(range.from, range.to)
    ),
    loadInboxReadMap(),
    loadCampaigns(db),
    fetchAllPages<Record<string, unknown>>((range) =>
      db
        .from('drip_ai_conversations')
        .select(
          'id,contact_id,campaign_id,status,needs_attention,exchange_count,follow_up_count,last_outbound_at,last_inbound_at,escalation_reason,takeover_at,updated_at'
        )
        .order('updated_at', { ascending: false })
        .range(range.from, range.to)
    ),
  ]);

  const historyContactIds = new Set<string>();
  if (focusContactId) historyContactIds.add(focusContactId);
  for (const msg of inbound) {
    if (msg.contact_id) historyContactIds.add(msg.contact_id);
  }

  const knownContactIds = new Set<string>(historyContactIds);
  for (const page of recentPages) {
    for (const msg of page) {
      if (msg.contact_id) knownContactIds.add(msg.contact_id);
    }
  }

  const [older, contactMap] = await Promise.all([
    historyContactIds.size
      ? fetchOlderMessages(db, [...historyContactIds], since)
      : Promise.resolve([] as MsgRow[]),
    loadContacts(db, [...knownContactIds]),
  ]);

  const byId = new Map<string, MsgRow>();
  for (const msg of [...recentPages.flat(), ...inbound, ...older]) {
    if (msg?.id) byId.set(msg.id, msg);
  }
  const messages = [...byId.values()];
  await attachLatestBodies(db, messages);

  const smsMessages = messages.filter((msg) =>
    isSmsMessage({ ...msg, body: msg.body || '' })
  );
  const unresolved = smsMessages.filter((msg) => !msg.campaign_id);
  const resolveCampaignId = unresolved.length
    ? await buildMessageCampaignResolver(db, unresolved)
    : (msg: { campaign_id: string | null }) => msg.campaign_id;

  const messageBodiesByKey = new Map<string, string[]>();

  for (const msg of smsMessages) {
    const campaignId = resolveCampaignId(msg);
    if (!campaignId || !msg.contact_id) continue;

    const key = `${msg.contact_id}:${campaignId}`;
    const at = msgTime(msg);
    const preview = { body: msg.body || '', direction: msg.direction, sent_at: at };

    const bodies = messageBodiesByKey.get(key) || [];
    if (msg.body) bodies.push(msg.body);
    messageBodiesByKey.set(key, bodies);

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
        lead_has_replied: msg.direction === 'inbound',
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
      existing.lead_has_replied = true;
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

  for (const conv of aiRows) {
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
    if (!thread.lead_has_replied) {
      thread.lead_has_replied = Boolean(thread.last_inbound_at);
    }
    if (thread.unread) {
      thread.needs_attention = true;
    }
  }

  let allThreads = Array.from(threadMap.values())
    .filter((t) => t.message_count > 0 && t.last_message)
    .sort((a, b) => {
      if (a.unread !== b.unread) return a.unread ? -1 : 1;
      return new Date(lastActivity(b)).getTime() - new Date(lastActivity(a)).getTime();
    });

  if (focusContactId) {
    allThreads = allThreads.filter((t) => t.contact_id === focusContactId);
  }

  const needsActionCount = allThreads.filter(
    (t) => t.needs_attention || t.status === 'escalated'
  ).length;

  const unreadCount = allThreads.filter((t) => t.unread).length;

  if (search) {
    allThreads = allThreads.filter((t) =>
      threadMatchesInboxSearch(t, search, messageBodiesByKey.get(`${t.contact_id}:${t.campaign_id}`))
    );
  }

  const threads = (search ? allThreads : allThreads.filter((t) => matchesFilter(t, filter))).map(
    (thread) => {
      const body = thread.last_message?.body || '';
      if (!thread.last_message || body.length <= 160) return thread;
      return {
        ...thread,
        last_message: { ...thread.last_message, body: `${body.slice(0, 160).trimEnd()}…` },
      };
    }
  );

  return {
    threads,
    needs_action_count: needsActionCount,
    unread_count: unreadCount,
  };
}

/** One shared load for the list and the sidebar badge. A second call within a few seconds is instant. */
export async function loadInboxThreads(
  filter: Filter = 'all',
  focusContactId?: string | null,
  searchQuery?: string | null
): Promise<InboxPayload> {
  const search = (searchQuery || '').trim();
  if (focusContactId || search) {
    return loadInboxThreadsNow(filter, focusContactId, search);
  }

  if (inboxCache && Date.now() - inboxCache.at < INBOX_CACHE_MS) {
    return applyInboxFilter(inboxCache.payload, filter);
  }

  if (!inboxInflight) {
    inboxInflight = loadInboxThreadsNow('all')
      .then((payload) => {
        inboxCache = { at: Date.now(), payload };
        return payload;
      })
      .finally(() => {
        inboxInflight = null;
      });
  }

  const payload = await inboxInflight;
  return applyInboxFilter(payload, filter);
}

function applyInboxFilter(payload: InboxPayload, filter: Filter): InboxPayload {
  if (filter === 'all') return payload;
  return {
    ...payload,
    threads: payload.threads.filter((thread) => matchesFilter(thread, filter)),
  };
}
