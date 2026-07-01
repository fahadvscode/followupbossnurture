'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, Link2 } from 'lucide-react';
import type { FubWebhookSetupStatus } from '@/lib/fub-webhooks-admin';

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 size={16} className="text-success shrink-0" />
  ) : (
    <AlertCircle size={16} className="text-warning shrink-0" />
  );
}

export function FubIntegrationSettings() {
  const [status, setStatus] = useState<FubWebhookSetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fub/webhooks', { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setStatus(data);
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Load failed' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function registerAll() {
    setBusy('register');
    setMessage(null);
    try {
      const res = await fetch('/api/fub/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'register_all' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      const parts: string[] = [];
      if (data.registered?.length) parts.push(`Registered: ${data.registered.join(', ')}`);
      if (data.alreadyActive?.length) parts.push(`Already active: ${data.alreadyActive.join(', ')}`);
      if (data.errors?.length) {
        parts.push(
          data.errors.map((e: { event: string; error: string }) => `${e.event}: ${e.error}`).join('; ')
        );
      }
      setMessage({ type: data.errors?.length ? 'err' : 'ok', text: parts.join(' · ') || 'Done.' });
      if (data.status) setStatus(data.status);
      else await load();
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Registration failed' });
    } finally {
      setBusy(null);
    }
  }

  async function syncRecent() {
    setBusy('sync');
    setMessage(null);
    try {
      const res = await fetch('/api/fub/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'sync_recent' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setMessage({
        type: 'ok',
        text: `Synced ${data.synced ?? 0} lead(s) from Follow Up Boss. ${data.enrolled ?? 0} drip enrollment(s) started/restarted.`,
      });
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Sync failed' });
    } finally {
      setBusy(null);
    }
  }

  if (loading && !status) {
    return (
      <div className="flex items-center gap-2 text-muted py-8">
        <Loader2 size={18} className="animate-spin" /> Loading integration status…
      </div>
    );
  }

  const allWebhooksActive =
    status?.events.every((e) => e.status === 'active') ?? false;

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 size={18} /> Follow Up Boss — automatic lead sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <StatusDot ok={Boolean(status?.autoSyncEnabled)} />
              <div>
                <p className="font-medium text-foreground">Auto-sync every minute (active now)</p>
                <p className="text-muted text-xs mt-1">
                  The cron job checks Follow Up Boss for leads updated in the last 3 hours and
                  imports them automatically. This works with your existing{' '}
                  <code className="text-[11px]">FUB_API_KEY</code> — no webhooks required.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <StatusDot ok={allWebhooksActive} />
              <div>
                <p className="font-medium text-foreground">Instant webhooks (optional, faster)</p>
                <p className="text-muted text-xs mt-1">
                  FUB has no webhooks screen in the app — they are registered via API. Use the button
                  below once{' '}
                  <code className="text-[11px]">FUB_SYSTEM_NAME</code> and{' '}
                  <code className="text-[11px]">FUB_SYSTEM_KEY</code> are in Vercel.
                </p>
              </div>
            </div>
          </div>

          {status?.webhookUrl ? (
            <div>
              <p className="text-xs text-muted mb-1">Webhook URL (paste into FUB via API registration)</p>
              <code className="block text-xs bg-muted/50 rounded-lg p-2 break-all">{status.webhookUrl}</code>
            </div>
          ) : (
            <p className="text-sm text-warning">
              Set <code className="text-[11px]">NEXT_PUBLIC_BASE_URL</code> in Vercel to your production URL.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy != null} onClick={() => void syncRecent()}>
              {busy === 'sync' ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-2" /> Syncing…
                </>
              ) : (
                <>
                  <RefreshCw size={14} className="mr-2" /> Sync recent FUB leads now
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy != null || !status?.systemRegistered}
              onClick={() => void registerAll()}
            >
              {busy === 'register' ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-2" /> Registering…
                </>
              ) : (
                'Register all FUB webhooks'
              )}
            </Button>
            <Button type="button" variant="secondary" disabled={loading} onClick={() => void load()}>
              Refresh status
            </Button>
          </div>

          {!status?.systemRegistered && (
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs text-foreground space-y-2">
              <p className="font-medium">To enable instant webhooks (one-time setup):</p>
              <ol className="list-decimal list-inside space-y-1 text-muted">
                <li>
                  Register your system at{' '}
                  <a
                    href="https://apps.followupboss.com/system-registration"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline"
                  >
                    apps.followupboss.com/system-registration
                  </a>
                </li>
                <li>
                  Add <code className="text-[11px]">FUB_SYSTEM_NAME</code> and{' '}
                  <code className="text-[11px]">FUB_SYSTEM_KEY</code> to Vercel env vars
                </li>
                <li>Redeploy, then click &quot;Register all FUB webhooks&quot; above</li>
              </ol>
              <p className="text-muted">
                Auto-sync every minute still works without this — new leads appear within ~1 minute.
              </p>
            </div>
          )}

          {message && (
            <p
              className={`text-sm ${message.type === 'ok' ? 'text-success' : 'text-danger'}`}
              role="status"
            >
              {message.text}
            </p>
          )}
        </CardContent>
      </Card>

      {status && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Webhook events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted border-b border-border">
                    <th className="pb-2 pr-4 font-medium">Event</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {status.events.map((row) => (
                    <tr key={row.event} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-mono text-xs">{row.event}</td>
                      <td className="py-2">
                        {row.status === 'active' && (
                          <span className="text-success text-xs">Active ✓</span>
                        )}
                        {row.status === 'missing' && (
                          <span className="text-muted text-xs">Not registered</span>
                        )}
                        {row.status === 'disabled' && (
                          <span className="text-warning text-xs">Disabled in FUB</span>
                        )}
                        {row.status === 'wrong_url' && (
                          <span className="text-warning text-xs">Wrong URL: {row.url}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
