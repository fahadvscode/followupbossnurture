'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function RunDueDripsDevButton() {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);

  if (process.env.NODE_ENV !== 'development') return null;

  async function run() {
    setBusy(true);
    setOut(null);
    try {
      const r = await fetch('/api/cron/send-drips');
      const j = (await r.json()) as Record<string, unknown>;
      setOut(JSON.stringify(j, null, 2));
    } catch (e) {
      setOut(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-dashed border-border p-3">
      <p className="text-xs text-muted">
        Local dev has no Vercel cron. After enrolling, use this to process due steps (same as GET{' '}
        <code className="text-[11px]">/api/cron/send-drips</code>). The JSON includes{' '}
        <code className="text-[11px]">diagnostics.skips</code> when a step is not ready or was auto-advanced.
      </p>
      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void run()}>
        {busy ? 'Running…' : 'Run due drips now'}
      </Button>
      {out && (
        <pre className="text-[11px] overflow-auto max-h-56 p-2 rounded bg-muted whitespace-pre-wrap break-all">
          {out}
        </pre>
      )}
    </div>
  );
}
