/**
 * Pause all but the NEWEST active standard drip enrollment per lead
 * (AI Nurture enrollments are untouched).
 *
 * Dry-run by default. Pass --apply to actually pause.
 *
 * Usage:
 *   npx tsx --env-file=.env.vercel.tmp scripts/dedupe-double-enrollments.ts
 *   npx tsx --env-file=.env.vercel.tmp scripts/dedupe-double-enrollments.ts --apply
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(url, key);
const apply = process.argv.includes('--apply');

type Row = {
  id: string;
  contact_id: string;
  status: string;
  enrolled_at: string;
  campaign: { id: string; name: string; campaign_type: string | null } | { id: string; name: string; campaign_type: string | null }[] | null;
  contact: { first_name: string | null; last_name: string | null; phone: string | null } | { first_name: string | null; last_name: string | null; phone: string | null }[] | null;
};

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

async function main() {
  const { data } = await db
    .from('drip_enrollments')
    .select(
      'id, contact_id, status, enrolled_at, campaign:drip_campaigns(id, name, campaign_type), contact:drip_contacts(first_name, last_name, phone)'
    )
    .eq('status', 'active');

  const rows = (data || []) as Row[];
  const byContact = new Map<string, Row[]>();
  for (const r of rows) {
    const camp = unwrap(r.campaign);
    if (camp?.campaign_type === 'ai_nurture') continue;
    const list = byContact.get(r.contact_id) || [];
    list.push(r);
    byContact.set(r.contact_id, list);
  }

  const toPause: Row[] = [];
  for (const [, enrolls] of byContact) {
    if (enrolls.length <= 1) continue;
    const sorted = [...enrolls].sort((a, b) => (a.enrolled_at < b.enrolled_at ? 1 : -1));
    const [keep, ...pause] = sorted;
    void keep;
    for (const e of pause) toPause.push(e);
  }

  console.log(`\n${apply ? 'PAUSING' : 'DRY RUN — would pause'} ${toPause.length} enrollment(s):\n`);
  for (const e of toPause) {
    const c = unwrap(e.contact);
    const camp = unwrap(e.campaign);
    const name = `${c?.first_name || ''} ${c?.last_name || ''}`.trim() || '(no name)';
    console.log(
      `  · ${name} · ${c?.phone || ''} · ${camp?.name} · enrolled ${e.enrolled_at.slice(0, 19)}`
    );
  }

  if (!apply) {
    console.log(`\nRe-run with --apply to actually pause these.\n`);
    return;
  }

  if (toPause.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from('drip_enrollments')
    .update({ status: 'paused', paused_at: now })
    .in(
      'id',
      toPause.map((e) => e.id)
    );

  if (error) {
    console.error('Update failed:', error);
    process.exit(1);
  }
  console.log(`\n✓ Paused ${toPause.length} enrollment(s).\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
