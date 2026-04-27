import { NextRequest, NextResponse } from 'next/server';
import { findDueMessagesWithDiagnostics, processDueMessage } from '@/lib/drip-engine';
import { findDueAiFollowUps, sendAiMessage } from '@/lib/ai-engine';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const isDev = process.env.NODE_ENV === 'development';

  if (!isDev && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ── Standard drip campaigns ──────────────────────────────────────
    const { due: dueMessages, skips } = await findDueMessagesWithDiagnostics();

    let sent = 0;
    let failed = 0;

    for (const msg of dueMessages) {
      const success = await processDueMessage(msg);
      if (success) sent++;
      else failed++;
    }

    // ── AI nurture follow-ups ────────────────────────────────────────
    let aiSent = 0;
    let aiEscalated = 0;

    if (process.env.DEEPSEEK_API_KEY?.trim()) {
      try {
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
          if (result.escalated) aiEscalated++;
        }
      } catch (aiErr) {
        console.error('AI follow-up pass error:', aiErr);
      }
    }

    const payload: Record<string, unknown> = {
      processed: dueMessages.length,
      sent,
      failed,
      ai_follow_ups_sent: aiSent,
      ai_escalated: aiEscalated,
      timestamp: new Date().toISOString(),
    };

    if (isDev) {
      payload.diagnostics = { skips };
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
