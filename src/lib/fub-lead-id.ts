import { mergePersonTags, searchPeopleByTag, getPersonByIdFull } from '@/lib/fub';
import { normalizeFubTags } from '@/lib/fub-contact-from-person';
import { getServiceClient } from '@/lib/supabase';

/** TB-082612028M or TB-0826SD2028M, optional uniqueness suffix -2 */
export const LEAD_ID_RE =
  /^[A-Z]{1,2}-\d{4}(?:SD|[0-3])\d{4}[A-Z](?:-\d+)?$/;

const CONDO_TAGS = new Set(['condo', 'condos']);
const TOWN_TAGS = new Set(['townhome', 'townhomes', 'townhouse', 'townhouses']);
const DETACHED_TAGS = new Set(['detached']);
const SEMI_TAGS = new Set(['semi-detached', 'semi detached', 'semidetached', 'semi']);
const CITY_TAGS = new Set([
  'brampton',
  'milton',
  'mississauga',
  'oakville',
  'markham',
  'toronto',
  'hamilton',
  'burlington',
  'vaughan',
  'etobicoke',
  'georgetown',
  'caledon',
]);

function firstLetter(text: string): string {
  for (const ch of text) {
    if (/[A-Za-z]/.test(ch)) return ch.toUpperCase();
  }
  return '';
}

function initials(person: Record<string, unknown>): string {
  const first = firstLetter(String(person.firstName || ''));
  const last = firstLetter(String(person.lastName || ''));
  return first + last || 'X';
}

function createdMmyy(person: Record<string, unknown>): string {
  const created = String(person.created || '');
  if (created.length >= 7 && created[4] === '-') {
    const year = created.slice(2, 4);
    const month = created.slice(5, 7);
    if (/^\d{2}$/.test(year) && /^\d{2}$/.test(month)) return month + year;
  }
  return '0000';
}

function propertyType(tags: string[]): string {
  const lowered = tags.map((t) => t.toLowerCase());
  if (lowered.some((t) => SEMI_TAGS.has(t))) return 'SD';
  if (lowered.some((t) => CONDO_TAGS.has(t))) return '1';
  if (lowered.some((t) => TOWN_TAGS.has(t))) return '2';
  if (lowered.some((t) => DETACHED_TAGS.has(t))) return '3';
  return '0';
}

function cityLetter(tags: string[]): string {
  for (const t of tags) {
    if (CITY_TAGS.has(t.toLowerCase())) return firstLetter(t) || 'X';
  }
  return 'X';
}

function phoneLast4(person: Record<string, unknown>): string {
  const phones = person.phones;
  if (!Array.isArray(phones)) return '0000';
  const ordered: string[] = [];
  for (const ph of phones) {
    if (!ph || typeof ph !== 'object') continue;
    const row = ph as { normalized?: string; value?: string; isPrimary?: boolean };
    const digits = String(row.normalized || row.value || '').replace(/\D+/g, '');
    if (!digits) continue;
    if (row.isPrimary) ordered.unshift(digits);
    else ordered.push(digits);
  }
  for (const digits of ordered) {
    if (digits.length >= 4) return digits.slice(-4);
  }
  return '0000';
}

export function existingLeadIdTags(tags: string[]): string[] {
  return tags.filter((t) => LEAD_ID_RE.test(t));
}

export function buildLeadId(person: Record<string, unknown>): string {
  const tags = normalizeFubTags(person.tags);
  return `${initials(person)}-${createdMmyy(person)}${propertyType(tags)}${phoneLast4(person)}${cityLetter(tags)}`;
}

/**
 * Give this person exactly one lead-ID tag.
 * Does nothing if they already have one. Never adds a second ID.
 * If the generated ID is already on someone else, appends -2, -3, …
 */
export async function ensureFubLeadIdTag(
  person: Record<string, unknown>
): Promise<{ tag: string; added: boolean }> {
  const rawId = person.id;
  const personId = typeof rawId === 'number' ? rawId : Number(rawId);
  if (!Number.isFinite(personId) || personId < 1) {
    throw new Error('FUB person missing id');
  }

  const tags = normalizeFubTags(person.tags);
  const existing = existingLeadIdTags(tags);
  if (existing.length > 0) {
    return { tag: existing[0], added: false };
  }

  const base = buildLeadId(person);
  let candidate = base;
  for (let n = 2; n <= 99; n++) {
    const holders = await searchPeopleByTag(candidate);
    const taken = holders.some((p) => p.id !== personId);
    if (!taken) break;
    candidate = `${base}-${n}`;
  }

  await mergePersonTags(personId, [candidate]);
  return { tag: candidate, added: true };
}

/** Stamp a unique lead-ID tag when a contact enters any drip. No-op if they already have one. */
export async function ensureLeadIdForContact(contactId: string): Promise<string | null> {
  const db = getServiceClient();
  const { data } = await db
    .from('drip_contacts')
    .select('fub_id, tags')
    .eq('id', contactId)
    .maybeSingle();

  if (!data?.fub_id) return null;

  const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
  const already = existingLeadIdTags(tags);
  if (already.length > 0) return already[0];

  const person = await getPersonByIdFull(Number(data.fub_id));
  const { tag, added } = await ensureFubLeadIdTag(person);
  if (tag && !tags.includes(tag)) {
    await db.from('drip_contacts').update({ tags: [...tags, tag] }).eq('id', contactId);
  }
  return added || tag ? tag : null;
}

