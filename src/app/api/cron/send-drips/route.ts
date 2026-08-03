import { NextRequest, NextResponse } from 'next/server';
import { findDueMessagesWithDiagnostics, processDueMessage } from '@/lib/drip-engine';
import { findDueAiFollowUps, findDueAiFirstTouches, sendAiMessage } from '@/lib/ai-engine';
import { AUTH_COOKIE } from '@/lib/auth';
import { isValidSessionCookie } from '@/lib/auth-session';
import { getServiceClient } from '@/lib/supabase';
import { summarizeErrorDetail } from '@/lib/delivery-error-meta';
import { syncRecentFubLeads } from '@/lib/fub-recent-sync';
import { healStuckEnrollments } from '@/lib/enrollment-heal';

async function authorizeCronRequest(request: NextRequest): Promise<{
  ok: boolean;
  manual: boolean;
}> {
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) return { ok: true, manual: true };

  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get('authorization')?.trim();
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { ok: true, manual: false };
  }

  const session = request.cookies.get(AUTH_COOKIE)?.value;
  if (await isValidSessionCookie(session)) {
    return { ok: true, manual: true };
  }

  if (!cronSecret) {
    return { ok: true, manual: false };
  }

  return { ok: false, manual: false };
}

/** Parse positive interval minutes from env; fall back to default. */
function cronIntervalMinutes(envName: string, fallback: number): number {
  const raw = process.env[envName]?.trim();
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

/**
 * True when this UTC minute should run a throttled job.
 * Cron still fires every minute; heavy work runs only on interval boundaries.
 * Manual / dashboard runs always return true via the force flag.
 */
function shouldRunThrottledJob(intervalMinutes: number, force: boolean, now = new Date()): boolean {
  if (force) return true;
  if (intervalMinutes <= 1) return true;
  return now.getUTCMinutes() % intervalMinutes === 0;
}

export async function GET(request: NextRequest) {
  const auth = await authorizeCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const fubInterval = cronIntervalMinutes('CRON_FUB_SYNC_INTERVAL_MINUTES', 15);
  const healInterval = cronIntervalMinutes('CRON_HEAL_INTERVAL_MINUTES', 30);
  const runFubSync = shouldRunThrottledJob(fubInterval, auth.manual);
  const runHeal = shouldRunThrottledJob(healInterval, auth.manual);

  try {
    // ── Auto-import recent FUB leads (backup; webhooks are primary) ───
    // Default: every 15 minutes (CRON_FUB_SYNC_INTERVAL_MINUTES). Always on manual run.
    let fubSynced = 0;
    let fubEnrolled = 0;
    let fubSkipped = !runFubSync;
    if (runFubSync) {
      try {
        const fub = await syncRecentFubLeads();
        fubSynced = fub.synced;
        fubEnrolled = fub.enrolled;
      } catch (fubErr) {
        console.error('FUB recent sync error:', fubErr);
      }
    }

    // ── Self-heal stuck enrollments ───────────────────────────────────
    // Default: every 30 minutes (CRON_HEAL_INTERVAL_MINUTES). Always on manual run.
    let healSummary = {
      synced_opted_out_enrollments: 0,
      healed_failed_steps: 0,
      opted_out_from_twilio: 0,
      skipped_invalid_phone: 0,
      paused_ai_enrollments: 0,
      paused_on_reply: 0,
      details: [] as string[],
    };
    let healSkipped = !runHeal;
    if (runHeal) {
      try {
        healSummary = await healStuckEnrollments(getServiceClient());
        if (healSummary.details.length > 0) {
          console.log('Enrollment heal:', healSummary);
        }
      } catch (healErr) {
        console.error('Enrollment heal error:', healErr);
      }
    }

    // ── Standard drip campaigns ──────────────────────────────────────
    const { due: dueMessages, skips } = await findDueMessagesWithDiagnostics();

    let sent = 0;
    let failed = 0;
    const failures: Array<{
      enrollmentId: string;
      campaignName: string;
      contactLabel: string;
      stepNumber: number;
      channel: string;
      error: string;
    }> = [];

    for (const msg of dueMessages) {
      const success = await processDueMessage(msg);
      if (success) {
        sent++;
        continue;
      }
      failed++;

      const contactLabel =
        `${msg.contact.first_name || ''} ${msg.contact.last_name || ''}`.trim() ||
        msg.contact.phone ||
        msg.contact.id;

      const db = getServiceClient();
      const { data: failedRow } = await db
        .from('drip_messages')
        .select('error_detail, channel')
        .eq('enrollment_id', msg.enrollment.id)
        .eq('step_number', msg.step.step_number)
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      failures.push({
        enrollmentId: msg.enrollment.id,
        campaignName: msg.campaign.name,
        contactLabel,
        stepNumber: msg.step.step_number,
        channel: failedRow?.channel || msg.step.step_type || 'sms',
        error: failedRow?.error_detail
          ? summarizeErrorDetail(failedRow.error_detail)
          : 'Send failed (no error logged — check phone, Twilio from number, or quiet hours)',
      });
    }

    // ── AI nurture: first touch (e.g. deferred from quiet hours) + follow-ups ──
    let aiSent = 0;
    let aiFirstTouchSent = 0;
    let aiEscalated = 0;
    let aiQuietHoursSkipped = 0;

    if (process.env.DEEPSEEK_API_KEY?.trim()) {
      try {
        const firstDue = await findDueAiFirstTouches();
        for (const item of firstDue) {
          const result = await sendAiMessage({
            enrollmentId: item.enrollment.id,
            contactId: item.enrollment.contact_id,
            campaignId: item.enrollment.campaign_id,
            contact: item.contact,
            isFollowUp: false,
          });
          if (result.sent) {
            aiSent++;
            aiFirstTouchSent++;
          }
          if (result.quietHours) aiQuietHoursSkipped++;
          if (result.escalated) aiEscalated++;
        }

        const aiDue = await findDueAiFollowUps();
        for (const item of aiDue) {
          const result = await sendAiMessage({
            enrollmentId: item.enrollment.id,
            contactId: item.enrollment.contact_id,
            campaignId: item.enrollment.campaign_id,
            contact: item.contact,
            isFollowUp: true,
          });
          if (result.sent) aiSent++;
          if (result.quietHours) aiQuietHoursSkipped++;
          if (result.escalated) aiEscalated++;
        }
      } catch (aiErr) {
        console.error('AI follow-up pass error:', aiErr);
      }
    }

    const payload: Record<string, unknown> = {
      enrollment_heal: healSummary,
      enrollment_heal_skipped: healSkipped,
      fub_sync_skipped: fubSkipped,
      fub_leads_synced: fubSynced,
      fub_enrollments: fubEnrolled,
      fub_sync_interval_minutes: fubInterval,
      heal_interval_minutes: healInterval,
      processed: dueMessages.length,
      sent,
      failed,
      ai_messages_sent: aiSent,
      ai_first_touch_sent: aiFirstTouchSent,
      ai_follow_ups_sent: aiSent - aiFirstTouchSent,
      ai_escalated: aiEscalated,
      ai_quiet_hours_skipped: aiQuietHoursSkipped,
      timestamp: new Date().toISOString(),
    };

    if (auth.manual) {
      payload.diagnostics = { skips, ...(failures.length ? { failures } : {}) };
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cron failed' },
      { status: 500 }
    );
  }
}
