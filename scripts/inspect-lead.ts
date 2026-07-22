/**
 * Inspect a single lead: tags, source, enrollments, recent messages.
 *
 * Usage:
 *   npx tsx --env-file=.env.vercel.tmp scripts/inspect-lead.ts "Mak Cha"
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(url, key);
const query = (process.argv[2] || '').trim();
if (!query) {
  console.error('Usage: scripts/inspect-lead.ts "First Last"');
  process.exit(1);
}

async function main() {
  const parts = query.split(/\s+/);
  const first = parts[0] || '';
  const last = parts.slice(1).join(' ');

  const { data: contacts } = await db
    .from('drip_contacts')
    .select('id, first_name, last_name, phone, email, tags, source, source_category, fub_id, opted_out')
    .ilike('first_name', `%${first}%`)
    .ilike('last_name', last ? `%${last}%` : '%');

  if (!contacts || contacts.length === 0) {
    console.log('No matching contacts.');
    return;
  }

  for (const c of contacts) {
    console.log(`\n── ${c.first_name} ${c.last_name} · ${c.phone || '—'} · fub_id=${c.fub_id}`);
    console.log(`   opted_out: ${c.opted_out}`);
    console.log(`   source: ${c.source || '—'}  ·  category: ${c.source_category || '—'}`);
    console.log(`   tags: ${JSON.stringify(c.tags || [])}`);

    const { data: enrolls } = await db
      .from('drip_enrollments')
      .select('id, status, current_step, enrolled_at, paused_at, campaign:drip_campaigns(name, campaign_type)')
      .eq('contact_id', c.id)
      .order('enrolled_at', { ascending: false });

    console.log(`   enrollments (${enrolls?.length || 0}):`);
    for (const e of enrolls || []) {
      const camp = Array.isArray(e.campaign) ? e.campaign[0] : e.campaign;
      console.log(
        `     · [${e.status}] ${camp?.name} — step ${e.current_step} — enrolled ${e.enrolled_at}`
      );
    }

    const { data: msgs } = await db
      .from('drip_messages')
      .select('direction, channel, body, sent_at, campaign:drip_campaigns(name)')
      .eq('contact_id', c.id)
      .order('sent_at', { ascending: false })
      .limit(15);

    console.log(`   recent messages (${msgs?.length || 0}):`);
    for (const m of msgs || []) {
      const camp = Array.isArray(m.campaign) ? m.campaign[0] : m.campaign;
      const preview = (m.body || '').slice(0, 80).replace(/\s+/g, ' ');
      console.log(
        `     · ${m.sent_at?.slice(0, 19)} ${m.direction} ${m.channel} · ${camp?.name || '—'} · ${preview}`
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
