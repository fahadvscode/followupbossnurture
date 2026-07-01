/** Extract FUB person IDs from webhook JSON (peopleCreated, peopleUpdated, etc.). */
export function extractFubWebhookPersonIds(body: unknown): number[] {
  if (!body || typeof body !== 'object') return [];

  const b = body as Record<string, unknown>;
  const ids: number[] = [];

  const pushId = (raw: unknown) => {
    const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    if (Number.isFinite(n) && n > 0 && !ids.includes(n)) ids.push(n);
  };

  if (Array.isArray(b.resourceIds)) {
    for (const id of b.resourceIds) pushId(id);
  }

  const person = b.person;
  if (person && typeof person === 'object' && 'id' in person) {
    pushId((person as { id: unknown }).id);
  }

  pushId(b.personId);

  const data = b.data;
  if (data && typeof data === 'object' && 'id' in data) {
    pushId((data as { id: unknown }).id);
  }

  return ids;
}
