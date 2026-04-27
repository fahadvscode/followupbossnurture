'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

type Props = {
  contactId: string;
  fubId: number | null;
  email: string | null;
};

export function FubPersonSync({ contactId, fubId, email }: Props) {
  const router = useRouter();
  const [emailInput, setEmailInput] = useState(email?.trim() || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function sync(body: Record<string, unknown>) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(
        `${typeof window !== 'undefined' ? window.location.origin : ''}/api/fub/sync-person`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'same-origin',
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const extra =
          Array.isArray(data.matches) && data.matches.length
            ? ` Matches: ${data.matches.map((m: { id: number }) => `#${m.id}`).join(', ')}.`
            : '';
        setMessage({
          type: 'err',
          text: (typeof data.error === 'string' ? data.error : 'Sync failed') + extra,
        });
        return;
      }
      const newId = typeof data.contactId === 'string' ? data.contactId : null;
      setMessage({
        type: 'ok',
        text:
          'Synced from Follow Up Boss. Tags and source were applied; active campaigns with matching trigger tags/sources may have auto-enrolled this lead.',
      });
      if (newId && newId !== contactId) {
        router.push(`/contacts/${newId}`);
      } else {
        router.refresh();
      }
    } catch {
      setMessage({ type: 'err', text: 'Network error.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Follow Up Boss</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted">
          Uses your <code className="text-[11px]">FUB_API_KEY</code> to load the full lead (same as the FUB webhook),
          then runs auto-enrollment when campaign trigger tags or sources match.
        </p>
        {fubId != null && (
          <p className="text-xs text-foreground">
            Linked FUB person ID: <strong>{fubId}</strong>
          </p>
        )}
        {fubId != null && (
          <Button type="button" variant="secondary" disabled={loading} onClick={() => void sync({ personId: fubId })}>
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin mr-2" /> Syncing…
              </>
            ) : (
              'Refresh from Follow Up Boss'
            )}
          </Button>
        )}
        {fubId == null && (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              No FUB link on this contact yet. Enter the lead&apos;s email as it appears in Follow Up Boss to import
              and link them.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1 min-w-0">
                <label className="block text-xs text-muted mb-1">Email in Follow Up Boss</label>
                <Input
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && emailInput.trim() && !loading) {
                      e.preventDefault();
                      void sync({ email: emailInput.trim() });
                    }
                  }}
                  placeholder="name@example.com"
                  type="email"
                  autoComplete="email"
                />
              </div>
              <Button
                type="button"
                disabled={loading || !emailInput.trim()}
                onClick={() => void sync({ email: emailInput.trim() })}
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-2" /> Import…
                  </>
                ) : (
                  'Import from FUB'
                )}
              </Button>
            </div>
          </div>
        )}
        {message && (
          <p
            className={`text-sm whitespace-pre-wrap ${message.type === 'ok' ? 'text-success' : 'text-danger'}`}
            role="status"
          >
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
