/**
 * One-time / manual repair for enrollments stuck retrying failed drip steps.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/heal-stuck-enrollments.ts
 */
import { createClient } from '@supabase/supabase-js';
import { healStuckEnrollments } from '../src/lib/enrollment-heal';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(url, key);

async function main() {
  console.log('Healing stuck enrollments...\n');
  const result = await healStuckEnrollments(db);

  console.log('Summary:');
  console.log(`  Synced opted-out enrollments: ${result.synced_opted_out_enrollments}`);
  console.log(`  Opted out (Twilio 21610):     ${result.opted_out_from_twilio}`);
  console.log(`  Advanced past failed step:    ${result.healed_failed_steps}`);
  console.log(`  Skipped invalid phone:        ${result.skipped_invalid_phone}`);
  console.log(`  Paused AI enrollments:        ${result.paused_ai_enrollments}`);

  if (result.details.length === 0) {
    console.log('\nNothing to heal — all enrollments look healthy.');
  } else {
    console.log('\nDetails:');
    for (const line of result.details) {
      console.log(`  • ${line}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
