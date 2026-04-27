'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, UserPlus } from 'lucide-react';

/**
 * Pull a single lead from FUB by email (POST /api/fub/sync-person). Fast; for testing one lead.
 */
export function ContactsQuickFubImport() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [personIdInput, setPersonIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'err'; text: string } | null>(null);

  async function run() {
    const trimmed = email.trim();
    const pid = personIdInput.trim();
    const personId = pid ? parseInt(pid, 10) : NaN;
    const usePersonId = Number.isFinite(personId) && personId > 0;
    if ((!trimmed && !usePersonId) || loading) return;
    setLoading(true);
    setMessage(null);
    try {
      const body = usePersonId ? { personId } : { email: trimmed };
      const res = await fetch(
        `${typeof window !== 'undefined' ? window.location.origin : ''}/api/fub/sync-person`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(body),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        contactId?: string;
        error?: string;
        matches?: { id: number; name: string }[];
      };

      if (!res.ok) {
        const extra =
          Array.isArray(data.matches) && data.matches.length
            ? ` Paste one FUB person ID below and try again: ${data.matches.map((m) => `#${m.id}`).join(', ')}.`
            : '';
        setMessage({
          type: 'err',
          text: (typeof data.error === 'string' ? data.error : 'Import failed') + extra,
        });
        return;
      }

      const id = typeof data.contactId === 'string' ? data.contactId : null;
      if (id) {
        router.push(`/contacts/${id}`);
        return;
      }
      setMessage({ type: 'err', text: 'No contact id returned.' });
    } catch {
      setMessage({ type: 'err', text: 'Network error.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <p className="text-xs text-muted leading-relaxed">
        <strong className="text-foreground">Import or update one lead</strong> from Follow Up Boss by email
        (seconds). This is what you want for testing — not the full sync below.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <Input
          type="email"
          placeholder="Email exactly as in FUB (e.g. jaydeepsingh073@gmail.com)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (email.trim() || personIdInput.trim()) && !loading) {
              e.preventDefault();
              void run();
            }
          }}
          className="flex-1 min-w-0"
          autoComplete="email"
        />
        <Button
          type="button"
          disabled={loading || (!email.trim() && !(parseInt(personIdInput.trim(), 10) > 0))}
          onClick={() => void run()}
        >
          {loading ? (
            <>
              <Loader2 size={14} className="mr-2 animate-spin shrink-0" />
              Importing…
            </>
          ) : (
            <>
              <UserPlus size={14} className="mr-2 shrink-0" />
              Import this lead
            </>
          )}
        </Button>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <Input
          type="text"
          inputMode="numeric"
          placeholder="Optional: FUB person ID (if several people share the email)"
          value={personIdInput}
          onChange={(e) => setPersonIdInput(e.target.value.replace(/\D/g, ''))}
          className="flex-1 min-w-0 text-sm"
        />
      </div>
      {message && (
        <p className="text-xs text-danger whitespace-pre-wrap" role="alert">
          {message.text}
        </p>
      )}
    </div>
  );
}
