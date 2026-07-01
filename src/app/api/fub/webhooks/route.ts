import { NextRequest, NextResponse } from 'next/server';
import {
  getFubWebhookSetupStatus,
  registerAllDripFubWebhooks,
} from '@/lib/fub-webhooks-admin';
import { deleteFubWebhook } from '@/lib/fub';
import { syncRecentFubLeads } from '@/lib/fub-recent-sync';

export async function GET() {
  try {
    const status = await getFubWebhookSetupStatus();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load webhook status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === 'string' ? body.action : 'register_all';

  try {
    if (action === 'register_all') {
      const result = await registerAllDripFubWebhooks();
      const status = await getFubWebhookSetupStatus();
      return NextResponse.json({ ok: true, ...result, status });
    }

    if (action === 'sync_recent') {
      const result = await syncRecentFubLeads();
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Action failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const idRaw = request.nextUrl.searchParams.get('id');
  const id = idRaw ? parseInt(idRaw, 10) : NaN;
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: 'Invalid webhook id' }, { status: 400 });
  }

  try {
    await deleteFubWebhook(id);
    const status = await getFubWebhookSetupStatus();
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500 }
    );
  }
}
