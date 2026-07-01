import { getServiceClient } from '@/lib/supabase';
import {
  getPersonByIdFull,
  listAllEventsForPerson,
  listAllNotesForPerson,
} from '@/lib/fub';
import { buildDripContactFieldsFromFub } from '@/lib/fub-contact-from-person';

type Db = ReturnType<typeof getServiceClient>;

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v && 'name' in v) {
    const n = (v as { name?: unknown }).name;
    return n != null ? String(n) : null;
  }
  return String(v);
}

function noteRowsForInsert(
  contactId: string,
  notes: Record<string, unknown>[]
): Record<string, unknown>[] {
  return notes
    .map((n) => {
      const id = n.id;
      const fub_note_id = typeof id === 'number' ? id : Number(id);
      if (!Number.isFinite(fub_note_id)) return null;
      return {
      contact_id: contactId,
      fub_note_id,
      subject: str(n.subject),
      body: str(n.body),
      is_html: Boolean(n.isHtml),
      note_type: str(n.type),
      created_by: str(n.createdBy),
      updated_by: str(n.updatedBy),
      fub_created_at: typeof n.created === 'string' ? n.created : null,
      fub_updated_at: typeof n.updated === 'string' ? n.updated : null,
      raw: safeRawJson(n),
    };
    })
    .filter(Boolean) as Record<string, unknown>[];
}

function safeRawJson(obj: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
  } catch {
    return {
      _note: 'raw omitted: not JSON-serializable',
      id: obj.id,
    };
  }
}

function eventRowsForInsert(
  contactId: string,
  events: Record<string, unknown>[]
): Record<string, unknown>[] {
  return events
    .map((e) => {
      const id = e.id;
      const fub_event_id = typeof id === 'number' ? id : Number(id);
      if (!Number.isFinite(fub_event_id)) return null;
    const occurred =
      typeof e.occurred === 'string'
        ? e.occurred
        : typeof e.created === 'string'
          ? e.created
          : null;
    return {
      contact_id: contactId,
      fub_event_id,
      event_type: str(e.type),
      message: str(e.message),
      description: str(e.description),
      event_source: str(e.source),
      occurred_at: occurred,
      property:
        e.property != null && typeof e.property === 'object' && !Array.isArray(e.property)
          ? safeRawJson(e.property as Record<string, unknown>)
          : null,
      raw: safeRawJson(e),
    };
    })
    .filter(Boolean) as Record<string, unknown>[];
}

async function insertInChunks(
  db: Db,
  table: 'drip_fub_notes' | 'drip_fub_events',
  rows: Record<string, unknown>[],
  chunkSize = 100
) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await db.from(table).insert(chunk);
    if (error) throw error;
  }
}

/** Events / notes whose message or type indicates a fresh lead inquiry. */
const INQUIRY_PATTERN = /inquir(y|ies)|registered|registration|property\s*(view|inquir)|lead\s*created/i;

function isInquiryEvent(e: Record<string, unknown>): boolean {
  const type = typeof e.type === 'string' ? e.type : '';
  const source = typeof e.source === 'string' ? e.source : '';
  const message = typeof e.message === 'string' ? e.message : '';
  const description = typeof e.description === 'string' ? e.description : '';
  return (
    INQUIRY_PATTERN.test(type) ||
    INQUIRY_PATTERN.test(message) ||
    INQUIRY_PATTERN.test(description) ||
    /facebook|zapier|lead\s*gen/i.test(source)
  );
}

function isInquiryNote(n: Record<string, unknown>): boolean {
  const subject = typeof n.subject === 'string' ? n.subject : '';
  const body = typeof n.body === 'string' ? n.body : '';
  const type = typeof n.type === 'string' ? n.type : '';
  return INQUIRY_PATTERN.test(subject) || INQUIRY_PATTERN.test(body) || INQUIRY_PATTERN.test(type);
}

function timestamp(v: unknown): number {
  if (typeof v !== 'string') return 0;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Fetches full person (allFields), notes, and events from FUB and upserts drip_contacts + child tables.
 * Also flags whether a **new inquiry** arrived since the last sync so callers can restart drips
 * even when tags didn't change (e.g. Zapier re-inquiry on an existing lead).
 */
export async function syncFubPersonDeep(
  db: Db,
  fubPersonId: number
): Promise<{ contactId: string; opted_out: boolean; hasNewInquiry: boolean }> {
  const person = await getPersonByIdFull(fubPersonId);
  if (!person || typeof person.id !== 'number') {
    throw new Error('Invalid FUB person response');
  }

  const payload = buildDripContactFieldsFromFub(person, { fullSnapshot: true });

  const { data: existing } = await db
    .from('drip_contacts')
    .select('id')
    .eq('fub_id', fubPersonId)
    .maybeSingle();

  let contactId: string;
  let priorLatestEventMs = 0;
  let priorLatestNoteMs = 0;
  let hadPriorInquiry = false;

  if (existing?.id) {
    contactId = existing.id;

    const [{ data: priorEvents }, { data: priorNotes }] = await Promise.all([
      db
        .from('drip_fub_events')
        .select('occurred_at, event_type, event_source, message, description')
        .eq('contact_id', contactId),
      db
        .from('drip_fub_notes')
        .select('fub_created_at, subject, body, note_type')
        .eq('contact_id', contactId),
    ]);

    for (const row of priorEvents || []) {
      priorLatestEventMs = Math.max(priorLatestEventMs, timestamp(row.occurred_at));
      if (
        isInquiryEvent({
          type: row.event_type,
          source: row.event_source,
          message: row.message,
          description: row.description,
        })
      ) {
        hadPriorInquiry = true;
      }
    }
    for (const row of priorNotes || []) {
      priorLatestNoteMs = Math.max(priorLatestNoteMs, timestamp(row.fub_created_at));
      if (isInquiryNote({ subject: row.subject, body: row.body, type: row.note_type })) {
        hadPriorInquiry = true;
      }
    }

    const { error } = await db
      .from('drip_contacts')
      .update(payload)
      .eq('fub_id', fubPersonId);
    if (error) throw error;
  } else {
    const { data: inserted, error } = await db
      .from('drip_contacts')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;
    if (!inserted?.id) throw new Error('Insert contact failed');
    contactId = inserted.id;
  }

  const [notes, events] = await Promise.all([
    listAllNotesForPerson(fubPersonId),
    listAllEventsForPerson(fubPersonId),
  ]);

  let hasNewInquiry = false;

  for (const e of events) {
    const occurred =
      typeof e.occurred === 'string'
        ? e.occurred
        : typeof e.created === 'string'
          ? e.created
          : null;
    const ts = timestamp(occurred);
    if (ts > priorLatestEventMs && isInquiryEvent(e)) {
      hasNewInquiry = true;
      break;
    }
  }

  if (!hasNewInquiry) {
    for (const n of notes) {
      const ts = timestamp(n.created);
      if (ts > priorLatestNoteMs && isInquiryNote(n)) {
        hasNewInquiry = true;
        break;
      }
    }
  }

  // Brand-new contact whose very first event on record is an inquiry counts as a new inquiry too.
  if (!existing?.id && !hasNewInquiry) {
    hasNewInquiry = events.some(isInquiryEvent) || notes.some(isInquiryNote);
  }

  // Suppress if we had inquiries before AND no new ones — nothing to restart on.
  if (hadPriorInquiry && priorLatestEventMs === 0 && priorLatestNoteMs === 0) {
    hasNewInquiry = false;
  }

  await db.from('drip_fub_notes').delete().eq('contact_id', contactId);
  await db.from('drip_fub_events').delete().eq('contact_id', contactId);

  if (notes.length > 0) {
    await insertInChunks(
      db,
      'drip_fub_notes',
      noteRowsForInsert(contactId, notes)
    );
  }
  if (events.length > 0) {
    await insertInChunks(
      db,
      'drip_fub_events',
      eventRowsForInsert(contactId, events)
    );
  }

  const { data: row } = await db
    .from('drip_contacts')
    .select('opted_out')
    .eq('id', contactId)
    .single();

  return { contactId, opted_out: Boolean(row?.opted_out), hasNewInquiry };
}
