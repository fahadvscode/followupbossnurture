/**
 * List leads with more than one ACTIVE drip enrollment (excluding AI Nurture).
 *
 * Usage:
 *   npx tsx --env-file=.env.vercel.tmp scripts/list-double-enrolled.ts
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(url, key);

type Row = {
  id: string;
  contact_id: string;
  status: string;
  current_step: number;
  enrolled_at: string;
  campaign: { id: string; name: string; campaign_type: string | null } | { id: string; name: string; campaign_type: string | null }[] | null;
  contact: { first_name: string | null; last_name: string | null; phone: string | null; email: string | null; tags: string[] | null } | { first_name: string | null; last_name: string | null; phone: string | null; email: string | null; tags: string[] | null }[] | null;
};

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

async function main() {
  const { data, error } = await db
    .from('drip_enrollments')
    .select(
      'id, contact_id, status, current_step, enrolled_at, campaign:drip_campaigns(id, name, campaign_type), contact:drip_contacts(first_name, last_name, phone, email, tags)'
    )
    .eq('status', 'active');

  if (error) {
    console.error(error);
    process.exit(1);
  }

  const rows = (data || []) as Row[];

  const byContact = new Map<string, Row[]>();
  for (const r of rows) {
    const camp = unwrap(r.campaign);
    if (camp?.campaign_type === 'ai_nurture') continue;
    const list = byContact.get(r.contact_id) || [];
    list.push(r);
    byContact.set(r.contact_id, list);
  }

  const multi = [...byContact.entries()].filter(([, v]) => v.length > 1);

  if (multi.length === 0) {
    console.log('\n✓ No leads are currently in more than one active standard drip.\n');
    return;
  }

  console.log(`\n⚠️  ${multi.length} lead(s) are enrolled in more than one active drip:\n`);
  for (const [contactId, enrolls] of multi) {
    const contact = unwrap(enrolls[0].contact);
    const name = `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim() || '(no name)';
    console.log(`── ${name} · ${contact?.phone || contact?.email || contactId}`);
    console.log(`   tags: ${JSON.stringify(contact?.tags || [])}`);
    for (const e of enrolls) {
      const camp = unwrap(e.campaign);
      console.log(
        `   · [${e.status}] ${camp?.name} — step ${e.current_step} — enrolled ${e.enrolled_at.slice(0, 19)}`
      );
    }
    console.log('');
  }
  console.log(`(${multi.length} leads · ${multi.reduce((s, [, v]) => s + v.length, 0)} enrollments)\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
