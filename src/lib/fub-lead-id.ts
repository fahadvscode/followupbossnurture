import {
  getPersonByIdFull,
  putPersonClientId,
  searchPeopleByCustomField,
  searchPeopleByTag,
} from '@/lib/fub';
import { normalizeFubTags } from '@/lib/fub-contact-from-person';
import { getServiceClient } from '@/lib/supabase';

/** TB-082612028M or TB-0826SD2028M, optional uniqueness suffix -2 */
export const LEAD_ID_RE =
  /^[A-Z]{1,2}-\d{4}(?:SD|[0-3])\d{4}[A-Z](?:-\d+)?$/;

/** FUB custom field name (label: Client ID). Case-sensitive. */
export const FUB_CLIENT_ID_FIELD = 'customClientID';

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

export function clientIdFromCustomField(person: Record<string, unknown>): string | null {
  const raw = person[FUB_CLIENT_ID_FIELD];
  const value = typeof raw === 'string' ? raw.trim() : raw != null ? String(raw).trim() : '';
  return LEAD_ID_RE.test(value) ? value : null;
}

function tagsWithoutLeadIds(tags: string[]): string[] {
  return tags.filter((t) => !LEAD_ID_RE.test(t));
}

async function clientIdTaken(candidate: string, personId: number): Promise<boolean> {
  const byField = await searchPeopleByCustomField(FUB_CLIENT_ID_FIELD, candidate);
  if (byField.some((p) => p.id !== personId)) return true;
  const byTag = await searchPeopleByTag(candidate);
  return byTag.some((p) => p.id !== personId);
}

export function buildLeadId(person: Record<string, unknown>): string {
  const tags = normalizeFubTags(person.tags);
  return `${initials(person)}-${createdMmyy(person)}${propertyType(tags)}${phoneLast4(person)}${cityLetter(tags)}`;
}

/**
 * Give this person exactly one Client ID in the FUB custom field.
 * Copies an existing ID tag into the field and strips ID tags.
 * Never adds a second ID. If the generated ID is taken, appends -2, -3, …
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
  const idTags = existingLeadIdTags(tags);
  const remaining = tagsWithoutLeadIds(tags);
  const fromField = clientIdFromCustomField(person);

  if (fromField) {
    if (idTags.length > 0) {
      await putPersonClientId(personId, fromField, remaining);
      person.tags = remaining;
    }
    return { tag: fromField, added: false };
  }

  if (idTags.length > 0) {
    const tag = idTags[0];
    await putPersonClientId(personId, tag, remaining);
    person[FUB_CLIENT_ID_FIELD] = tag;
    person.tags = remaining;
    return { tag, added: true };
  }

  const base = buildLeadId(person);
  let candidate = base;
  for (let n = 2; n <= 99; n++) {
    if (!(await clientIdTaken(candidate, personId))) break;
    candidate = `${base}-${n}`;
  }

  await putPersonClientId(personId, candidate);
  person[FUB_CLIENT_ID_FIELD] = candidate;
  return { tag: candidate, added: true };
}

/** Stamp a unique Client ID when a contact enters any drip. No-op if they already have one. */
export async function ensureLeadIdForContact(contactId: string): Promise<string | null> {
  const db = getServiceClient();
  const { data } = await db
    .from('drip_contacts')
    .select('fub_id, tags, custom_fields')
    .eq('id', contactId)
    .maybeSingle();

  if (!data?.fub_id) return null;

  const cf =
    data.custom_fields && typeof data.custom_fields === 'object' && !Array.isArray(data.custom_fields)
      ? (data.custom_fields as Record<string, unknown>)
      : {};
  const fromField = clientIdFromCustomField(cf);
  if (fromField) return fromField;

  const person = await getPersonByIdFull(Number(data.fub_id));
  const { tag, added } = await ensureFubLeadIdTag(person);
  if (tag && added) {
    await db
      .from('drip_contacts')
      .update({ custom_fields: { ...cf, [FUB_CLIENT_ID_FIELD]: tag } })
      .eq('id', contactId);
  }
  return added || tag ? tag : null;
}
