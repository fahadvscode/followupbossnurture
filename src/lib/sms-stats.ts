import type { SupabaseClient } from '@supabase/supabase-js';
import { startOfAppDayUtcIso } from '@/lib/utils';

/** Outbound SMS only — excludes email, FUB tasks, and action-plan log rows. */
export function outboundSmsQuery(db: SupabaseClient) {
  return db
    .from('drip_messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'outbound')
    .eq('channel', 'sms');
}

/** Inbound SMS only. */
export function inboundSmsQuery(db: SupabaseClient) {
  return db
    .from('drip_messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'inbound')
    .eq('channel', 'sms');
}

export function outboundSmsTodayQuery(db: SupabaseClient) {
  return outboundSmsQuery(db)
    .gte('sent_at', startOfAppDayUtcIso())
    .in('status', ['queued', 'sent', 'delivered']);
}
