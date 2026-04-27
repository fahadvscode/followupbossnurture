import { NextRequest, NextResponse } from 'next/server';
import { findDueMessagesWithDiagnostics, processDueMessage } from '@/lib/drip-engine';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const isDev = process.env.NODE_ENV === 'development';

  if (!isDev && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { due: dueMessages, skips } = await findDueMessagesWithDiagnostics();

    let sent = 0;
    let failed = 0;

    for (const msg of dueMessages) {
      const success = await processDueMessage(msg);
      if (success) sent++;
      else failed++;
    }

    const payload: Record<string, unknown> = {
      processed: dueMessages.length,
      sent,
      failed,
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
