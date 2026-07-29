import type { getServiceClient } from '@/lib/supabase';
import { markContactOptedOut } from '@/lib/contact-opt-out';
import {
  errorDetailIndicatesUnsubscribed,
  isTwilioPermanentStoredFailure,
  summarizeErrorDetail,
} from '@/lib/delivery-error-meta';
import { pauseEnrollmentIfLeadReplied } from '@/lib/lead-replied';
import { isPlausibleSmsPhone } from '@/lib/utils';

type Db = ReturnType<typeof getServiceClient>;

export type HealStuckResult = {
  synced_opted_out_enrollments: number;
  healed_failed_steps: number;
  opted_out_from_twilio: number;
  skipped_invalid_phone: number;
  paused_ai_enrollments: number;
  paused_on_reply: number;
  details: string[];
};

function unwrapOne<T>(row: T | T[] | null | undefined): T | null {
  if (row == null) return null;
  return Array.isArray(row) ? (row[0] ?? null) : row;
}

/** One-shot repair for enrollments stuck retrying failed SMS steps every cron tick. */
export async function healStuckEnrollments(db: Db): Promise<HealStuckResult> {
  const result: HealStuckResult = {
    synced_opted_out_enrollments: 0,
    healed_failed_steps: 0,
    opted_out_from_twilio: 0,
    skipped_invalid_phone: 0,
    paused_ai_enrollments: 0,
    paused_on_reply: 0,
    details: [],
  };

  const { data: activeEnrollments } = await db
    .from('drip_enrollments')
    .select(
      'id, contact_id, campaign_id, status, current_step, enrolled_at, contact:drip_contacts(id, first_name, last_name, phone, opted_out), campaign:drip_campaigns(name, campaign_type, pause_on_sms_reply)'
    )
    .eq('status', 'active');

  for (const row of activeEnrollments || []) {
    const contact = unwrapOne(
      row.contact as unknown as {
        id: string;
        first_name: string;
        last_name: string;
        phone: string | null;
        opted_out: boolean;
      } | null
    );
    const campaign = unwrapOne(
      row.campaign as unknown as {
        name: string;
        campaign_type?: string;
        pause_on_sms_reply?: boolean | null;
      } | null
    );
    const label =
      `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim() ||
      contact?.phone ||
      row.contact_id;

    if (campaign && contact) {
      const paused = await pauseEnrollmentIfLeadReplied(
        db,
        {
          id: row.id as string,
          contact_id: row.contact_id as string,
          enrolled_at: row.enrolled_at as string,
        },
        campaign
      );
      if (paused) {
        result.paused_on_reply++;
        result.details.push(
          `${label}: paused ${campaign.name || 'campaign'} — lead already replied by SMS`
        );
        continue;
      }
    }

    if (contact?.opted_out) {
      await db.from('drip_enrollments').update({ status: 'opted_out' }).eq('id', row.id);
      result.synced_opted_out_enrollments++;
      result.details.push(`${label}: active enrollment → opted_out (contact already opted out)`);
      continue;
    }

    const nextStep = (row.current_step as number) + 1;

    const { data: priorFail } = await db
      .from('drip_messages')
      .select('id, error_detail, channel')
      .eq('enrollment_id', row.id)
      .eq('step_number', nextStep)
      .eq('direction', 'outbound')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (priorFail) {
      if (errorDetailIndicatesUnsubscribed(priorFail.error_detail)) {
        if (contact) {
          await markContactOptedOut(db, contact, 'TWILIO_21610');
          result.opted_out_from_twilio++;
          result.details.push(`${label}: opted out (Twilio 21610)`);
        }
      } else if (isTwilioPermanentStoredFailure(priorFail.error_detail)) {
        await db
          .from('drip_enrollments')
          .update({ current_step: nextStep })
          .eq('id', row.id);
        result.healed_failed_steps++;
        result.details.push(
          `${label}: advanced past failed step ${nextStep} (${summarizeErrorDetail(priorFail.error_detail) || 'send failed'})`
        );
      } else {
        result.details.push(
          `${label}: step ${nextStep} waiting for SMS retry (${summarizeErrorDetail(priorFail.error_detail) || 'transient failure'})`
        );
      }
      continue;
    }

    const { data: nextStepRow } = await db
      .from('drip_campaign_steps')
      .select('step_type')
      .eq('campaign_id', row.campaign_id)
      .eq('step_number', nextStep)
      .maybeSingle();

    if (
      nextStepRow?.step_type === 'sms' &&
      contact &&
      !isPlausibleSmsPhone(contact.phone)
    ) {
      const now = new Date().toISOString();
      await db.from('drip_messages').insert({
        enrollment_id: row.id,
        contact_id: row.contact_id,
        campaign_id: row.campaign_id,
        step_number: nextStep,
        direction: 'outbound',
        body: `[SMS skipped — invalid phone number]`,
        status: 'failed',
        sent_at: now,
        channel: 'sms',
        error_detail: {
          source: 'app',
          phase: 'config',
          message: `Invalid phone on file: ${contact.phone}`,
        },
      });
      await db
        .from('drip_enrollments')
        .update({ current_step: nextStep })
        .eq('id', row.id);
      result.skipped_invalid_phone++;
      result.details.push(`${label}: skipped invalid phone ${contact.phone} on step ${nextStep}`);
    }
  }

  // AI first-touch loops: active conv with no outbound but repeated failed SMS rows
  const { data: aiConvos } = await db
    .from('drip_ai_conversations')
    .select('id, enrollment_id, contact_id, campaign_id, status')
    .eq('status', 'active')
    .is('last_outbound_at', null);

  for (const conv of aiConvos || []) {
    const { count } = await db
      .from('drip_messages')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', conv.enrollment_id)
      .eq('direction', 'outbound')
      .eq('status', 'failed')
      .eq('channel', 'sms');

    if ((count || 0) < 1) continue;

    const now = new Date().toISOString();
    await db
      .from('drip_enrollments')
      .update({ status: 'paused', paused_at: now })
      .eq('id', conv.enrollment_id)
      .eq('status', 'active');
    await db
      .from('drip_ai_conversations')
      .update({
        status: 'paused',
        escalation_reason: 'SMS delivery failed — fix phone or opt-out before resuming',
      })
      .eq('id', conv.id);
    result.paused_ai_enrollments++;
    result.details.push(`AI enrollment ${conv.enrollment_id}: paused after failed first-touch SMS`);
  }

  return result;
}
