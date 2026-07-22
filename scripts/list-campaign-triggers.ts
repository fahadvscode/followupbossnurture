/**
 * List every active campaign with its trigger tags, sources, and groups so
 * you can spot overlap that causes a single lead to enroll in multiple drips.
 *
 * Usage (local .env.local):
 *   npx tsx --env-file=.env.local scripts/list-campaign-triggers.ts
 *
 * Usage (production env):
 *   vercel env pull .env.vercel.tmp --environment=production --yes
 *   npx tsx --env-file=.env.vercel.tmp scripts/list-campaign-triggers.ts
 *   rm .env.vercel.tmp
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(url, key);

type TriggerGroup = { label?: string; tags?: string[] };

type Row = {
  id: string;
  name: string;
  status: string;
  campaign_type: string | null;
  trigger_tags: string[] | null;
  trigger_sources: string[] | null;
  trigger_groups: TriggerGroup[] | null;
  trigger_min_groups: number | null;
};

function norm(t: string): string {
  return t.trim().toLowerCase();
}

async function main() {
  const { data, error } = await db
    .from('drip_campaigns')
    .select(
      'id, name, status, campaign_type, trigger_tags, trigger_sources, trigger_groups, trigger_min_groups'
    )
    .order('name');

  if (error) {
    console.error(error);
    process.exit(1);
  }

  const campaigns = (data || []) as Row[];
  const active = campaigns.filter((c) => c.status === 'active');
  const paused = campaigns.filter((c) => c.status !== 'active');

  console.log(`\n=== ACTIVE campaigns (${active.length}) ===\n`);
  for (const c of active) printCampaign(c);

  if (paused.length > 0) {
    console.log(`\n=== NOT active (${paused.length}) — will not enroll ===\n`);
    for (const c of paused) {
      console.log(`  · [${c.status}] ${c.name}`);
    }
  }

  // Overlap detection
  const tagToCampaigns = new Map<string, string[]>();
  const sourceToCampaigns = new Map<string, string[]>();

  for (const c of active) {
    const allTags = new Set<string>();
    for (const t of c.trigger_tags || []) allTags.add(norm(t));
    for (const g of c.trigger_groups || []) {
      for (const t of g?.tags || []) allTags.add(norm(t));
    }
    for (const t of allTags) {
      if (!t) continue;
      const list = tagToCampaigns.get(t) || [];
      list.push(c.name);
      tagToCampaigns.set(t, list);
    }
    for (const s of c.trigger_sources || []) {
      const n = norm(s);
      if (!n) continue;
      const list = sourceToCampaigns.get(n) || [];
      list.push(c.name);
      sourceToCampaigns.set(n, list);
    }
  }

  const tagOverlap = [...tagToCampaigns.entries()].filter(([, v]) => v.length > 1);
  const sourceOverlap = [...sourceToCampaigns.entries()].filter(([, v]) => v.length > 1);

  if (tagOverlap.length === 0 && sourceOverlap.length === 0) {
    console.log('\n✓ No overlapping triggers between active campaigns.\n');
    return;
  }

  console.log('\n⚠️  OVERLAPPING TRIGGERS — a lead with any of these will enroll in ALL listed campaigns:\n');
  for (const [tag, names] of tagOverlap) {
    console.log(`  tag "${tag}" is used by:`);
    for (const n of names) console.log(`     • ${n}`);
  }
  for (const [src, names] of sourceOverlap) {
    console.log(`  source "${src}" is used by:`);
    for (const n of names) console.log(`     • ${n}`);
  }
  console.log('');
}

function printCampaign(c: Row) {
  console.log(`  ${c.name}   (${c.campaign_type || 'standard'})`);
  const tags = c.trigger_tags || [];
  const srcs = c.trigger_sources || [];
  const groups = c.trigger_groups || [];
  if (tags.length) console.log(`     tags:    ${tags.join(', ')}`);
  if (srcs.length) console.log(`     sources: ${srcs.join(', ')}`);
  if (groups.length) {
    const min = c.trigger_min_groups || 1;
    console.log(`     groups:  (need ${min}+)`);
    for (const g of groups) {
      console.log(`        • ${g.label || 'group'}: ${(g.tags || []).join(', ')}`);
    }
  }
  if (!tags.length && !srcs.length && !groups.length) {
    console.log(`     ⚠️  no triggers configured`);
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
