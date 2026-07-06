import type { getServiceClient } from '@/lib/supabase';

type Db = ReturnType<typeof getServiceClient>;

/** Mark contact + all active/paused enrollments opted out (SMS STOP, Twilio 21610, etc.). */
export async function markContactOptedOut(
  db: Db,
  contact: { id: string; phone: string | null },
  reason: string
): Promise<void> {
  await db.from('drip_contacts').update({ opted_out: true }).eq('id', contact.id);

  await db
    .from('drip_enrollments')
    .update({ status: 'opted_out' })
    .eq('contact_id', contact.id)
    .in('status', ['active', 'paused']);

  await db.from('drip_opt_outs').insert({
    contact_id: contact.id,
    phone: contact.phone || '',
    reason,
  });
}
