import type { FUBPerson } from '@/types';

export function normalizeFubApiKey(raw: string | undefined): string {
  if (!raw?.trim()) return '';
  let k = raw.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  if (k.toLowerCase().startsWith('bearer ')) {
    k = k.slice(7).trim();
  }
  return k;
}

/** Read on each call so env changes apply after restart (and avoid stale module scope in long-lived dev workers). */
function getFubBaseUrl(): string {
  return (process.env.FUB_BASE_URL || 'https://api.followupboss.com/v1').replace(/\/$/, '');
}

/** Parent-process env wins over `.env.local`; an old shell `export FUB_API_KEY=…` can cause 401 until unset. */
function getFubApiKey(): string {
  return normalizeFubApiKey(process.env.FUB_API_KEY);
}

export function isFubApiConfigured(): boolean {
  return Boolean(getFubApiKey());
}

function getFubSystemHeaders(): { system: string; key: string } | null {
  const system =
    process.env.FUB_SYSTEM_NAME?.trim() ||
    process.env.FUB_SYSTEM?.trim() ||
    '';
  const key = process.env.FUB_SYSTEM_KEY?.trim() || '';
  if (!system || !key) return null;
  return { system, key };
}

export function isFubWebhookAdminConfigured(): boolean {
  return isFubApiConfigured() && getFubSystemHeaders() != null;
}

function getAuthHeader(): string {
  const key = getFubApiKey();
  if (!key) {
    throw new Error('FUB_API_KEY is empty');
  }
  // FUB: Basic auth, API key as username, blank password (see https://docs.followupboss.com/reference/authentication)
  return 'Basic ' + Buffer.from(`${key}:`, 'utf8').toString('base64');
}

async function fubFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${getFubBaseUrl()}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FUB API ${res.status}: ${text}`);
  }

  return res.json();
}

async function fubWebhookAdminFetch(endpoint: string, options: RequestInit = {}) {
  const sys = getFubSystemHeaders();
  if (!sys) {
    throw new Error('FUB_SYSTEM_NAME and FUB_SYSTEM_KEY are required for webhook management');
  }
  return fubFetch(endpoint, {
    ...options,
    headers: {
      'X-System': sys.system,
      'X-System-Key': sys.key,
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}

export async function getPeople(params: {
  limit?: number;
  offset?: number;
  sort?: string;
  tag?: string;
  /** e.g. allFields for custom fields and extended person data */
  fields?: string;
} = {}): Promise<{ people: FUBPerson[]; _metadata: { total: number } }> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.offset) searchParams.set('offset', String(params.offset));
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.tag) searchParams.set('tag', params.tag);
  if (params.fields) searchParams.set('fields', params.fields);

  const query = searchParams.toString();
  return fubFetch(`/people${query ? '?' + query : ''}`);
}

export async function getPersonById(id: number): Promise<FUBPerson> {
  const data = await fubFetch(`/people/${id}`);
  return data;
}

/** Resolve FUB person id(s) by email (GET /people?email=…). */
export async function searchPeopleByEmail(email: string): Promise<FUBPerson[]> {
  const trimmed = email.trim();
  if (!trimmed) return [];
  const params = new URLSearchParams({
    email: trimmed,
    limit: '10',
    fields: 'id,firstName,lastName,emails,phones,source,tags,stage,assignedTo',
  });
  const data = (await fubFetch(`/people?${params}`)) as { people?: FUBPerson[] };
  return data.people || [];
}

/** Recently changed FUB people (for cron auto-sync when webhooks are not registered). */
export async function getRecentlyUpdatedPeople(
  limit = 40
): Promise<Array<{ id: number; updated?: string; created?: string }>> {
  const params = new URLSearchParams({
    sort: '-updated',
    limit: String(Math.min(100, Math.max(1, limit))),
    fields: 'id,updated,created',
  });
  const data = (await fubFetch(`/people?${params}`)) as {
    people?: Array<{ id: number; updated?: string; created?: string }>;
  };
  return data.people || [];
}

function coercePersonRecord(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid FUB person payload');
  }
  const o = data as Record<string, unknown>;
  if (typeof o.id === 'number') return o;
  const p = o.person;
  if (p && typeof p === 'object' && typeof (p as { id?: unknown }).id === 'number') {
    return p as Record<string, unknown>;
  }
  const people = o.people;
  if (Array.isArray(people) && people[0] && typeof (people[0] as { id?: unknown }).id === 'number') {
    return people[0] as Record<string, unknown>;
  }
  throw new Error('Invalid FUB person payload shape');
}

/** Full person including custom* fields (FUB fields=allFields). */
export async function getPersonByIdFull(id: number): Promise<Record<string, unknown>> {
  const data = await fubFetch(`/people/${id}?fields=allFields`);
  return coercePersonRecord(data);
}

export async function getEventById(id: number): Promise<{ personId?: number }> {
  const data = (await fubFetch(`/events/${id}`)) as {
    event?: { personId?: number };
    events?: { personId?: number }[];
    personId?: number;
  };
  if (data.event && typeof data.event.personId === 'number') return { personId: data.event.personId };
  if (Array.isArray(data.events) && data.events[0]?.personId != null) {
    return { personId: data.events[0].personId };
  }
  if (typeof data.personId === 'number') return { personId: data.personId };
  throw new Error(`FUB event ${id} missing personId`);
}

export async function getNoteById(id: number): Promise<{ personId?: number }> {
  const data = (await fubFetch(`/notes/${id}`)) as {
    note?: { personId?: number };
    notes?: { personId?: number }[];
    personId?: number;
  };
  if (data.note && typeof data.note.personId === 'number') return { personId: data.note.personId };
  if (Array.isArray(data.notes) && data.notes[0]?.personId != null) {
    return { personId: data.notes[0].personId };
  }
  if (typeof data.personId === 'number') return { personId: data.personId };
  throw new Error(`FUB note ${id} missing personId`);
}

export async function listAllNotesForPerson(
  personId: number
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let offset = 0;
  const limit = 100;
  for (let guard = 0; guard < 1000; guard++) {
    const data = (await fubFetch(
      `/notes?personId=${personId}&limit=${limit}&offset=${offset}`
    )) as { notes?: Record<string, unknown>[] };
    const notes = data.notes || [];
    out.push(...notes);
    if (notes.length < limit) break;
    offset += limit;
  }
  return out;
}

function eventsEndpoint(personId: number, nextToken?: string): string {
  if (nextToken) {
    if (nextToken.startsWith('http')) {
      try {
        const u = new URL(nextToken);
        return u.pathname.replace(/^\/v\d+/, '') + u.search;
      } catch {
        /* fall through */
      }
    }
    if (nextToken.startsWith('/')) {
      const path = nextToken.replace(/^\/v\d+/, '');
      return path.startsWith('/') ? path : `/${path}`;
    }
    const params = new URLSearchParams({
      personId: String(personId),
      limit: '100',
      next: nextToken,
    });
    return `/events?${params}`;
  }
  return `/events?personId=${personId}&limit=100`;
}

export async function listAllEventsForPerson(
  personId: number
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let next: string | undefined;
  for (let guard = 0; guard < 500; guard++) {
    const data = (await fubFetch(eventsEndpoint(personId, next))) as {
      events?: Record<string, unknown>[];
      _metadata?: { next?: string };
    };
    const events = data.events || [];
    out.push(...events);
    next = data._metadata?.next;
    if (!next) break;
  }
  return out;
}

export async function pushEvent(personId: number, event: {
  type: string;
  message: string;
  source: string;
}) {
  return fubFetch('/events', {
    method: 'POST',
    body: JSON.stringify({
      person: { id: personId },
      source: event.source,
      type: event.type,
      message: event.message,
    }),
  });
}

/** Create a Follow Up Boss task for a person (POST /tasks). */
/** Register a one-off marketing email in FUB (POST /emCampaigns). Pair with postEmEmailDelivered. */
export async function createEmCampaign(args: {
  originId: string;
  name: string;
  subject: string;
  bodyHtml: string;
}): Promise<{ id: number }> {
  const data = (await fubFetch('/emCampaigns', {
    method: 'POST',
    body: JSON.stringify({
      origin: 'DripPlatform',
      originId: args.originId,
      name: args.name,
      subject: args.subject,
      bodyHtml: args.bodyHtml,
    }),
  })) as { id?: number };
  if (typeof data.id !== 'number') {
    throw new Error('FUB emCampaigns: missing id in response');
  }
  return { id: data.id };
}

/** Tell FUB the email was delivered (POST /emEvents) — shows on person timeline under that user. */
export async function postEmEmailDelivered(args: {
  campaignId: number;
  recipient: string;
  occurred: string;
  personId?: number;
  userId?: number;
}): Promise<unknown> {
  const ev: Record<string, unknown> = {
    type: 'delivered',
    occurred: args.occurred,
    recipient: args.recipient,
    campaignId: String(args.campaignId),
  };
  if (args.personId != null) ev.personId = args.personId;
  if (args.userId != null) ev.userId = args.userId;
  return fubFetch('/emEvents', {
    method: 'POST',
    body: JSON.stringify({ emEvents: [ev] }),
  });
}

export async function createFubTask(args: {
  personId: number;
  name: string;
  type: string;
  dueDateTime: string;
  assignedUserId?: number;
  assignedTo?: string;
  remindSecondsBefore?: number;
}): Promise<unknown> {
  const body: Record<string, unknown> = {
    personId: args.personId,
    name: args.name,
    type: args.type,
    dueDateTime: args.dueDateTime,
  };
  if (args.assignedUserId != null) body.assignedUserId = args.assignedUserId;
  if (args.assignedTo) body.assignedTo = args.assignedTo;
  if (args.remindSecondsBefore != null) body.remindSecondsBefore = args.remindSecondsBefore;
  return fubFetch('/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** List action plans (GET /actionPlans). */
export type FubUserLite = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
};

/** All FUB users (paginated), sorted by name. See GET /users. */
export async function listAllFubUsers(): Promise<FubUserLite[]> {
  const out: FubUserLite[] = [];
  let offset = 0;
  for (let guard = 0; guard < 50; guard++) {
    const sp = new URLSearchParams();
    sp.set('limit', '100');
    sp.set('offset', String(offset));
    sp.set('sort', 'name');
    sp.set('fields', 'id,name,firstName,lastName,email,role,status');
    const data = (await fubFetch(`/users?${sp}`)) as {
      users?: Record<string, unknown>[];
      _metadata?: { total?: number };
    };
    const batch = data.users || [];
    for (const u of batch) {
      const id = Number(u.id);
      if (!Number.isFinite(id)) continue;
      const first = String(u.firstName || '').trim();
      const last = String(u.lastName || '').trim();
      const combined = `${first} ${last}`.trim();
      const name = String(u.name || combined || `User #${id}`);
      out.push({
        id,
        name,
        email: String(u.email || ''),
        role: String(u.role || ''),
        status: String(u.status || ''),
      });
    }
    const total = data._metadata?.total ?? 0;
    if (out.length >= total || batch.length < 100) break;
    offset += 100;
  }
  out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return out;
}

export async function listActionPlans(params: {
  limit?: number;
  offset?: number;
  status?: string;
} = {}): Promise<{ actionPlans: { id: number; name: string; status: string }[]; _metadata: { total: number } }> {
  const sp = new URLSearchParams();
  sp.set('limit', String(params.limit || 100));
  if (params.offset) sp.set('offset', String(params.offset));
  sp.set('status', params.status || 'Active');
  return fubFetch(`/actionPlans?${sp}`) as Promise<{ actionPlans: { id: number; name: string; status: string }[]; _metadata: { total: number } }>;
}

/** Apply an action plan to a person (POST /actionPlansPeople). FUB sends email/task from its channels. */
export async function applyActionPlan(personId: number, actionPlanId: number): Promise<unknown> {
  return fubFetch('/actionPlansPeople', {
    method: 'POST',
    body: JSON.stringify({ personId, actionPlanId }),
  });
}

export async function listFubWebhooks(): Promise<
  Array<{ id: number; event: string; status: string; url: string }>
> {
  const data = (await fubWebhookAdminFetch('/webhooks?limit=100')) as {
    webhooks?: Array<{ id: number; event: string; status: string; url: string }>;
  };
  return data.webhooks || [];
}

export async function registerFubWebhook(url: string, event: string) {
  return fubWebhookAdminFetch('/webhooks', {
    method: 'POST',
    body: JSON.stringify({ url, event }),
  });
}

export async function deleteFubWebhook(id: number) {
  return fubWebhookAdminFetch(`/webhooks/${id}`, { method: 'DELETE' });
}

/** @deprecated Use registerFubWebhook */
export async function subscribeWebhook(url: string, event: string) {
  return registerFubWebhook(url, event);
}
