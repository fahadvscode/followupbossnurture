/**
 * Restart latest enrollment for a campaign using the given Twilio from number, then send due SMS.
 * Usage: npx tsx --env-file=.env.local scripts/trigger-drip-test.ts +16475605822
 */
import { createClient } from '@supabase/supabase-js';
import { processDueStepsForEnrollment } from '../src/lib/drip-engine';

const fromArg = process.argv[2] || '';
const fromDigits = fromArg.replace(/\D/g, '');
if (!fromDigits) {
  console.error('Usage: npx tsx --env-file=.env.local scripts/trigger-drip-test.ts +16475605822');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(url, key);

function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return phone.startsWith('+') ? phone : '+' + digits;
}

function phonesMatch(a: string | null | undefined, b: string): boolean {
  return normalizePhone(a).replace(/\D/g, '') === normalizePhone(b).replace(/\D/g, '');
}

async function main() {
  const { data: campaigns, error: cErr } = await db
    .from('drip_campaigns')
    .select('id, name, status, twilio_from_number')
    .not('twilio_from_number', 'is', null);

  if (cErr) {
    console.error('Campaign query failed:', cErr.message);
    process.exit(1);
  }

  const campaign = (campaigns || []).find((c) => phonesMatch(c.twilio_from_number, fromDigits));
  if (!campaign) {
    console.error('No campaign with twilio_from_number matching', fromArg);
    console.error(
      'Campaigns with from numbers:',
      (campaigns || []).map((c) => ({ name: c.name, from: c.twilio_from_number, status: c.status }))
    );
    process.exit(1);
  }

  console.log('Campaign:', campaign.name, '| status:', campaign.status);

  if (campaign.status !== 'active') {
    console.error('Campaign is not active — activate it in the app first.');
    process.exit(1);
  }

  const { data: enrollments } = await db
    .from('drip_enrollments')
    .select('id, status, current_step, contact:drip_contacts(first_name, last_name, phone, opted_out)')
    .eq('campaign_id', campaign.id)
    .order('enrolled_at', { ascending: false })
    .limit(5);

  if (!enrollments?.length) {
    console.error('No enrollments for this campaign.');
    process.exit(1);
  }

  for (const e of enrollments) {
    const contact = Array.isArray(e.contact) ? e.contact[0] : e.contact;
    console.log(
      '-',
      contact?.first_name,
      contact?.last_name,
      contact?.phone,
      '| status',
      e.status,
      '| step',
      e.current_step
    );
  }

  const target = enrollments.find((e) => e.status === 'active') || enrollments[0];
  const contact = Array.isArray(target.contact) ? target.contact[0] : target.contact;

  if (contact?.opted_out) {
    console.error('Contact is opted out.');
    process.exit(1);
  }
  if (!contact?.phone?.trim()) {
    console.error('Contact has no phone.');
    process.exit(1);
  }

  const now = new Date().toISOString();
  await db
    .from('drip_enrollments')
    .update({
      status: 'active',
      current_step: 0,
      paused_at: null,
      completed_at: null,
      enrolled_at: now,
    })
    .eq('id', target.id);

  console.log('\nRestarted enrollment for', contact.phone);

  const { due, skips } = await import('../src/lib/drip-engine').then((m) =>
    m.findDueMessagesWithDiagnostics()
  );
  const mine = due.filter((m) => m.enrollment.id === target.id);
  const mySkips = skips.filter((s) => s.enrollmentId === target.id);

  if (mySkips.length) {
    console.log('\nSkips:', JSON.stringify(mySkips, null, 2));
  }

  const result = await processDueStepsForEnrollment(target.id);
  console.log('\nSend result:', result, '| due before send:', mine.length);

  const { data: msgs } = await db
    .from('drip_messages')
    .select('status, body, error_detail, sent_at')
    .eq('enrollment_id', target.id)
    .order('sent_at', { ascending: false })
    .limit(3);

  console.log('\nRecent messages:', JSON.stringify(msgs, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
