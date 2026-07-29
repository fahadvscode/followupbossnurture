/**
 * Recent SMS send health (last 48h).
 *
 *   npx tsx --env-file=.env.vercel.tmp scripts/sms-health-check.ts
 */
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error('Missing Supabase env');
  process.exit(1);
}

const db = createClient(url, key);

async function testTwilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!sid || !token) {
    return { ok: false, error: 'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing' };
  }
  try {
    const client = twilio(sid, token);
    const account = await client.api.accounts(sid).fetch();
    return {
      ok: true,
      status: account.status,
      friendlyName: account.friendlyName,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  console.log('\n=== Twilio account ===\n');
  const tw = await testTwilio();
  console.log(tw);

  const { data: recent } = await db
    .from('drip_messages')
    .select('id, status, direction, channel, sent_at, body, error_detail, twilio_sid')
    .eq('channel', 'sms')
    .eq('direction', 'outbound')
    .gte('sent_at', since)
    .order('sent_at', { ascending: false })
    .limit(30);

  const rows = recent || [];
  const sent = rows.filter((r) => r.status === 'sent' || r.status === 'queued').length;
  const failed = rows.filter((r) => r.status === 'failed').length;

  console.log(`\n=== Outbound SMS (last 48h, latest 30 rows) ===\n`);
  console.log(`  sent/queued: ${sent}  failed: ${failed}\n`);

  for (const r of rows.slice(0, 15)) {
    const preview = (r.body || '').slice(0, 50).replace(/\s+/g, ' ');
    const err =
      r.error_detail && typeof r.error_detail === 'object'
        ? (r.error_detail as { message?: string; code?: unknown }).message ||
          JSON.stringify(r.error_detail)
        : '';
    console.log(`  ${r.sent_at?.slice(0, 19)} [${r.status}] ${preview}${err ? ` — ${String(err).slice(0, 80)}` : ''}`);
  }

  const { count: stuckFailed } = await db
    .from('drip_messages')
    .select('id', { count: 'exact', head: true })
    .eq('channel', 'sms')
    .eq('direction', 'outbound')
    .eq('status', 'failed')
    .gte('sent_at', since);

  const { data: activeEnrollments } = await db
    .from('drip_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  console.log(`\n  Failed SMS rows (48h): ${stuckFailed ?? 0}`);
  console.log(`  Active enrollments: ${(activeEnrollments as unknown as number) ?? '?'}`);

  const { data: dueSample } = await db
    .from('drip_enrollments')
    .select('id, current_step, campaign:drip_campaigns(name)')
    .eq('status', 'active')
    .limit(5);

  console.log('\n=== Sample active enrollments ===\n');
  for (const e of dueSample || []) {
    const camp = Array.isArray(e.campaign) ? e.campaign[0] : e.campaign;
    console.log(`  · ${camp?.name} — step ${e.current_step}`);
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
