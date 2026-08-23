/**
 * Cluster real SMS replies so inbox templates can match how Fahad actually texts.
 *
 *   npx tsx --env-file=.env.local.pull scripts/analyze-inbox-replies.ts
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(url, key);

type Msg = {
  id: string;
  contact_id: string;
  campaign_id: string | null;
  direction: string;
  body: string;
  step_number: number | null;
  channel: string | null;
  sent_at: string | null;
  created_at: string;
};

async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const page = 1000;
  const out: T[] = [];
  for (let from = 0; from < 20000; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < page) break;
  }
  return out;
}

function isSms(m: Msg): boolean {
  const ch = (m.channel || '').toLowerCase();
  if (ch && ch !== 'sms') return false;
  const b = m.body || '';
  if (b.startsWith('[Email') || b.startsWith('[FUB') || b.startsWith('[SMS skipped')) return false;
  return true;
}

function normalize(body: string): string {
  return body
    .replace(/\s+/g, ' ')
    .replace(/\b(hi|hey|hello)\s+[A-Z][a-z]{1,20}\b/gi, '$1 {first}')
    .replace(/\b[A-Z][a-z]{1,20}\b(?=,|\s—|\s-)/g, '{name}')
    .trim();
}

function bucket(body: string): string {
  const t = body.toLowerCase();
  if (/spam|junk|inbox|email(ed)? you|sent (you )?(an )?email|check your email/.test(t)) return 'check_email';
  if (/visit|come (by|in|down)|office|in person|walk you through|model home|sales centre|sales center/.test(t))
    return 'visit_office';
  if (/\b(call|phone|quick call|hop on|chat on the phone|give me a call|i('ll| will) call)\b/.test(t))
    return 'call';
  if (/floor plan|price list|pricing|brochure|package|pdf|I('ll| will) send/.test(t)) return 'sending_info';
  if (/assignment|assign(ed)? unit|resale|inventory/.test(t)) return 'assignment_inventory';
  if (/parking|locker|maintenance|closing cost|deposit/.test(t)) return 'unit_details';
  if (/book|appointment|what time|available today|tomorrow|this week/.test(t)) return 'book_time';
  if (/no worries|no rush|keep you posted|whenever you('re| are) ready|all good/.test(t))
    return 'keep_in_touch';
  if (/following up|just checking|did you (get|see|have a chance)/.test(t)) return 'follow_up';
  if (/thanks for (getting|texting|reaching|the reply)/.test(t)) return 'thanks';
  if (/\b(opt|stop|unsubscribe|remove)\b/.test(t)) return 'opt_out_ack';
  if (/\?/.test(t)) return 'question';
  return 'other';
}

async function main() {
  const msgs = await fetchAll<Msg>((from, to) =>
    db
      .from('drip_messages')
      .select('id,contact_id,campaign_id,direction,body,step_number,channel,sent_at,created_at')
      .eq('direction', 'outbound')
      .is('step_number', null)
      .order('created_at', { ascending: false })
      .range(from, to)
  );

  const sms = msgs.filter(isSms);
  console.log(`outbound step_number=null rows: ${msgs.length}, sms-like: ${sms.length}`);

  const byBucket = new Map<string, { count: number; samples: string[] }>();
  for (const m of sms) {
    const b = bucket(m.body || '');
    const row = byBucket.get(b) || { count: 0, samples: [] };
    row.count += 1;
    if (row.samples.length < 8) {
      const n = normalize(m.body || '');
      if (n.length > 20 && !row.samples.includes(n)) row.samples.push(n.slice(0, 280));
    }
    byBucket.set(b, row);
  }

  const ranked = [...byBucket.entries()].sort((a, b) => b[1].count - a[1].count);
  console.log('\n=== buckets (manual/AI replies, no drip step) ===\n');
  for (const [k, v] of ranked) {
    console.log(`\n## ${k}  (${v.count})`);
    for (const s of v.samples) console.log(`  - ${s}`);
  }

  const inbound = await fetchAll<{ body: string }>((from, to) =>
    db
      .from('drip_messages')
      .select('body')
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .range(from, to)
  );

  const inBuckets = new Map<string, number>();
  for (const m of inbound) {
    const t = (m.body || '').toLowerCase();
    const keys = [
      ['price', /price|how much|cost|\$/],
      ['floor_plan', /floor plan|layout|sq ?ft|square/],
      ['visit', /visit|come in|office|see (it|you)|in person/],
      ['call', /call me|can you call|phone/],
      ['email', /email|e-mail|inbox/],
      ['parking', /parking|locker/],
      ['assignment', /assignment|resale|inventory/],
      ['available', /available|still (left|available)|sold out/],
      ['stop', /\b(stop|unsubscribe|remove me)\b/],
    ] as const;
    for (const [name, re] of keys) {
      if (re.test(t)) inBuckets.set(name, (inBuckets.get(name) || 0) + 1);
    }
  }
  console.log('\n=== inbound themes ===\n');
  for (const [k, n] of [...inBuckets.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${n}`);
  }
  console.log(`\ninbound total: ${inbound.length}`);

  const { data: takeover } = await db
    .from('drip_ai_conversations')
    .select('contact_id,campaign_id,status')
    .eq('status', 'human_takeover')
    .limit(500);

  console.log(`\nhuman_takeover threads: ${takeover?.length || 0}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
