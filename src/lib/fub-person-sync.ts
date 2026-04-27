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

/**
 * Fetches full person (allFields), notes, and events from FUB and upserts drip_contacts + child tables.
 */
export async function syncFubPersonDeep(
  db: Db,
  fubPersonId: number
): Promise<{ contactId: string; opted_out: boolean }> {
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

  if (existing?.id) {
    const { error } = await db
      .from('drip_contacts')
      .update(payload)
      .eq('fub_id', fubPersonId);
    if (error) throw error;
    contactId = existing.id;
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

  return { contactId, opted_out: Boolean(row?.opted_out) };
}
