/**
 * Rewind enrollments that skipped SMS steps after transient Twilio failures (billing).
 *
 *   npx tsx --env-file=.env.vercel.tmp scripts/rewind-billing-skipped-sms.ts
 *   npx tsx --env-file=.env.vercel.tmp scripts/rewind-billing-skipped-sms.ts --apply
 */
import { createClient } from '@supabase/supabase-js';
import { isTwilioRetryableFailure } from '../src/lib/delivery-error-meta';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error('Missing Supabase env');
  process.exit(1);
}

const db = createClient(url, key);
const apply = process.argv.includes('--apply');
const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

async function main() {
  const { data: failed } = await db
    .from('drip_messages')
    .select('id, enrollment_id, contact_id, step_number, error_detail, sent_at')
    .eq('channel', 'sms')
    .eq('direction', 'outbound')
    .eq('status', 'failed')
    .gte('sent_at', since)
    .not('enrollment_id', 'is', null)
    .not('step_number', 'is', null);

  const retryable = (failed || []).filter((m) => isTwilioRetryableFailure(m.error_detail));
  console.log(`\nRetryable failed SMS since ${since.slice(0, 10)}: ${retryable.length}\n`);

  const rewinds: Array<{ enrollmentId: string; step: number; fromStep: number; label: string }> =
    [];

  for (const msg of retryable) {
    const step = msg.step_number as number;
    const enrollmentId = msg.enrollment_id as string;
    if (!step || !enrollmentId) continue;

    const { data: success } = await db
      .from('drip_messages')
      .select('id')
      .eq('enrollment_id', enrollmentId)
      .eq('step_number', step)
      .eq('direction', 'outbound')
      .in('status', ['sent', 'queued', 'delivered'])
      .limit(1)
      .maybeSingle();

    if (success) continue;

    const { data: enr } = await db
      .from('drip_enrollments')
      .select('id, current_step, status, contact:drip_contacts(first_name, last_name, phone)')
      .eq('id', enrollmentId)
      .maybeSingle();

    if (!enr || enr.status !== 'active') continue;
    const current = enr.current_step as number;
    if (current < step) continue;

    const c = Array.isArray(enr.contact) ? enr.contact[0] : enr.contact;
    const label =
      `${c?.first_name || ''} ${c?.last_name || ''}`.trim() || c?.phone || enrollmentId;

    const targetStep = Math.max(0, step - 1);
    if (current === targetStep) continue;

    rewinds.push({
      enrollmentId,
      step,
      fromStep: current,
      label,
    });
  }

  const byEnr = new Map<string, (typeof rewinds)[0]>();
  for (const r of rewinds) {
    const existing = byEnr.get(r.enrollmentId);
    if (!existing || r.step < existing.step) byEnr.set(r.enrollmentId, r);
  }

  const unique = [...byEnr.values()];
  if (unique.length === 0) {
    console.log('No enrollments need rewinding.\n');
    return;
  }

  console.log(`${apply ? 'REWIND' : 'DRY RUN'} — ${unique.length} enrollment(s):\n`);
  for (const r of unique) {
    console.log(
      `  · ${r.label}: step ${r.step} never sent — current_step ${r.fromStep} → ${r.step - 1}`
    );
  }

  if (!apply) {
    console.log('\nRe-run with --apply to update.\n');
    return;
  }

  for (const r of unique) {
    await db
      .from('drip_enrollments')
      .update({ current_step: Math.max(0, r.step - 1) })
      .eq('id', r.enrollmentId)
      .eq('status', 'active');
  }
  console.log(`\n✓ Rewound ${unique.length} enrollment(s). Next cron will retry those SMS steps.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
