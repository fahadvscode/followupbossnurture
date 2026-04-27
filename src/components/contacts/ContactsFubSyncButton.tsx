'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

/**
 * Full FUB → contacts sync. Uses fetch + manual redirect so submission is reliable
 * (native form + nested client Button can fail to submit in some Next/RSC setups).
 */
export function ContactsFubSyncButton() {
  const [loading, setLoading] = useState(false);

  async function runSync() {
    if (loading) return;
    const ok = window.confirm(
      'This syncs your entire Follow Up Boss account into this app (every contact). ' +
        'It can take a long time and does not use the contact search box. ' +
        'To test one lead, use “Import this lead” instead.\n\nContinue with full account sync?'
    );
    if (!ok) return;
    setLoading(true);
    try {
      const res = await fetch('/api/contacts/sync', {
        method: 'POST',
        credentials: 'same-origin',
        redirect: 'manual',
      });

      const loc = res.headers.get('Location');
      if (
        loc &&
        (res.status === 301 ||
          res.status === 302 ||
          res.status === 303 ||
          res.status === 307 ||
          res.status === 308)
      ) {
        window.location.assign(loc);
        return;
      }

      if (res.type === 'opaqueredirect' || res.status === 0) {
        window.location.assign('/contacts');
        return;
      }

      setLoading(false);
      const hint =
        res.status >= 400
          ? ` (HTTP ${res.status})`
          : '';
      window.location.assign(`/contacts?sync_error=${encodeURIComponent('Sync did not redirect as expected' + hint)}`);
    } catch {
      setLoading(false);
      window.location.assign(
        `/contacts?sync_error=${encodeURIComponent('Network error while starting sync')}`
      );
    }
  }

  return (
    <Button type="button" variant="secondary" disabled={loading} onClick={() => void runSync()}>
      <RefreshCw size={14} className={loading ? 'mr-2 animate-spin' : 'mr-2'} />
      {loading ? 'Full sync running…' : 'Sync entire FUB account'}
    </Button>
  );
}
