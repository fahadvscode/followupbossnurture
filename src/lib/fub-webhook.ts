import { getEventById, getNoteById } from '@/lib/fub';

function pushUniqueId(ids: number[], raw: unknown) {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  if (Number.isFinite(n) && n > 0 && !ids.includes(n)) ids.push(n);
}

/** Parse person IDs from FUB webhook `uri` (e.g. …/people?id=40773,40772). */
export function parsePersonIdsFromFubUri(uri: unknown): number[] {
  if (typeof uri !== 'string' || !uri.trim()) return [];
  try {
    const u = new URL(uri);
    const idParam = u.searchParams.get('id');
    if (!idParam) return [];
    const ids: number[] = [];
    for (const part of idParam.split(',')) pushUniqueId(ids, part.trim());
    return ids;
  } catch {
    return [];
  }
}

/** Extract FUB person IDs from webhook JSON (peopleCreated, peopleUpdated, etc.). */
export function extractFubWebhookPersonIds(body: unknown): number[] {
  if (!body || typeof body !== 'object') return [];

  const b = body as Record<string, unknown>;
  const ids: number[] = [];

  if (Array.isArray(b.resourceIds)) {
    for (const id of b.resourceIds) pushUniqueId(ids, id);
  }

  for (const id of parsePersonIdsFromFubUri(b.uri)) pushUniqueId(ids, id);

  const person = b.person;
  if (person && typeof person === 'object' && 'id' in person) {
    pushUniqueId(ids, (person as { id: unknown }).id);
  }

  pushUniqueId(ids, b.personId);

  const data = b.data;
  if (data && typeof data === 'object' && 'id' in data) {
    pushUniqueId(ids, (data as { id: unknown }).id);
  }

  return ids;
}

const EVENT_RESOURCE_EVENTS = new Set(['eventsCreated']);
const NOTE_RESOURCE_EVENTS = new Set(['notesCreated', 'notesUpdated']);

/**
 * Resolve person IDs for any FUB webhook event.
 * `eventsCreated` / `notesCreated` send resource IDs for the event/note, not the person.
 */
export async function resolveFubWebhookPersonIds(body: unknown): Promise<number[]> {
  if (!body || typeof body !== 'object') return [];
  const b = body as Record<string, unknown>;
  const event = typeof b.event === 'string' ? b.event : '';
  const resourceIds = Array.isArray(b.resourceIds) ? b.resourceIds : [];

  if (EVENT_RESOURCE_EVENTS.has(event) && resourceIds.length > 0) {
    const personIds: number[] = [];
    for (const raw of resourceIds) {
      const eventId = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
      if (!Number.isFinite(eventId)) continue;
      try {
        const row = await getEventById(eventId);
        pushUniqueId(personIds, row.personId);
      } catch (err) {
        console.error(`FUB webhook: could not resolve event ${eventId} to person`, err);
      }
    }
    return personIds;
  }

  if (NOTE_RESOURCE_EVENTS.has(event) && resourceIds.length > 0) {
    const personIds: number[] = [];
    for (const raw of resourceIds) {
      const noteId = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
      if (!Number.isFinite(noteId)) continue;
      try {
        const row = await getNoteById(noteId);
        pushUniqueId(personIds, row.personId);
      } catch (err) {
        console.error(`FUB webhook: could not resolve note ${noteId} to person`, err);
      }
    }
    return personIds;
  }

  return extractFubWebhookPersonIds(body);
}
