import { mapSource } from '@/lib/source-mapper';

/** FUB sometimes returns graphs that break JSON.stringify (circular refs). JSONB must be plain JSON. */
export function cloneRecordForJsonb(record: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(record)) as Record<string, unknown>;
  } catch {
    return {
      _note: 'FUB snapshot omitted: payload was not JSON-serializable (e.g. circular data).',
      id: record.id,
    };
  }
}

export function normalizeFubTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) =>
      typeof t === 'string' ? t : (t as { name?: string })?.name || ''
    )
    .filter(Boolean);
}

function primaryFromList(
  list: unknown,
  pick: (x: { value?: string; isPrimary?: boolean }) => string | null
): string | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const arr = list as { value?: string; isPrimary?: boolean }[];
  const primary = arr.find((p) => p.isPrimary);
  return pick(primary || arr[0]);
}

export function primaryPhoneFromPerson(person: Record<string, unknown>): string | null {
  return primaryFromList(person.phones, (p) => p.value || null);
}

export function primaryEmailFromPerson(person: Record<string, unknown>): string | null {
  return primaryFromList(person.emails, (p) => p.value || null);
}

export function extractCustomFieldsFromFubPerson(
  person: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(person)) {
    if (k.startsWith('custom') && k !== 'customFields') {
      out[k] = v;
    }
  }
  const nested = person.customFields;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    Object.assign(out, nested as Record<string, unknown>);
  }
  return out;
}

function assignedAgentString(person: Record<string, unknown>): string | null {
  const assigned = person.assignedTo ?? person.assignedAgent;
  if (assigned == null) return null;
  if (typeof assigned === 'string') return assigned;
  if (typeof assigned === 'object' && assigned && 'name' in assigned) {
    const n = (assigned as { name?: unknown }).name;
    return n != null ? String(n) : null;
  }
  return String(assigned);
}

export function buildDripContactFieldsFromFub(
  person: Record<string, unknown>,
  options: { fullSnapshot?: boolean } = {}
): Record<string, unknown> {
  const id = person.id;
  if (typeof id !== 'number') {
    throw new Error('FUB person missing numeric id');
  }

  const tags = normalizeFubTags(person.tags);
  const sourceStr =
    typeof person.source === 'string'
      ? person.source
      : person.source != null
        ? String(person.source)
        : null;
  const { category, detail } = mapSource(sourceStr, tags);
  const customFields = extractCustomFieldsFromFubPerson(person);
  let customFieldsJson: Record<string, unknown> = {};
  try {
    customFieldsJson =
      Object.keys(customFields).length > 0
        ? (JSON.parse(JSON.stringify(customFields)) as Record<string, unknown>)
        : {};
  } catch {
    customFieldsJson = { _note: 'custom fields omitted: not JSON-serializable' };
  }

  const sourceUrl =
    typeof person.sourceUrl === 'string'
      ? person.sourceUrl
      : typeof person.sourceURL === 'string'
        ? person.sourceURL
        : null;

  const createdVia =
    typeof person.createdVia === 'string' ? person.createdVia : null;

  const row: Record<string, unknown> = {
    fub_id: id,
    first_name: person.firstName != null ? String(person.firstName) : null,
    last_name: person.lastName != null ? String(person.lastName) : null,
    email: primaryEmailFromPerson(person),
    phone: primaryPhoneFromPerson(person),
    source: sourceStr,
    source_category: category,
    source_detail: detail,
    tags,
    stage: typeof person.stage === 'string' ? person.stage : null,
    assigned_agent: assignedAgentString(person),
    fub_created_at: typeof person.created === 'string' ? person.created : null,
    fub_updated_at: typeof person.updated === 'string' ? person.updated : null,
    source_url: sourceUrl,
    fub_created_via: createdVia,
    custom_fields: customFieldsJson,
  };

  if (options.fullSnapshot) {
    row.fub_snapshot = cloneRecordForJsonb(person);
    row.fub_last_synced_at = new Date().toISOString();
  }

  return row;
}
