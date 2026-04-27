'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { DripCampaign } from '@/types';
import { RunDueDripsDevButton } from '@/components/contacts/RunDueDripsDevButton';

type Props = {
  contactId: string;
  enrolledCampaignIds: string[];
  hasPhone: boolean;
  hasEmail: boolean;
};

export function ContactEnrollCampaign({
  contactId,
  enrolledCampaignIds,
  hasPhone,
  hasEmail,
}: Props) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<DripCampaign[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [campaignId, setCampaignId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/campaigns')
      .then((r) => r.json())
      .then((d) => setCampaigns((d.campaigns || []) as DripCampaign[]))
      .catch(() => setCampaigns([]))
      .finally(() => setLoadingList(false));
  }, []);

  const choices = campaigns.filter(
    (c) => c.status !== 'archived' && !enrolledCampaignIds.includes(c.id)
  );

  async function enroll() {
    if (!campaignId) {
      setMessage({ type: 'err', text: 'Choose a campaign first.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enroll',
          contact_id: contactId,
          campaign_id: campaignId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          type: 'err',
          text: typeof data.error === 'string' ? data.error : 'Enrollment failed.',
        });
        return;
      }
      setMessage({
        type: 'ok',
        text:
          process.env.NODE_ENV === 'development'
            ? 'Enrolled. Use “Run due drips now” below (or GET /api/cron/send-drips) — local dev has no cron.'
            : 'Enrolled. Drips run on the cron schedule.',
      });
      setCampaignId('');
      router.refresh();
    } catch {
      setMessage({ type: 'err', text: 'Network error.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Enroll in a campaign</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted">
          Adds this contact to the drip in this app (not the same as FUB action plans). Ensure the campaign is{' '}
          <strong>active</strong>, SMS touches have a Twilio &quot;from&quot; number, and the contact has a phone for
          SMS / email for email steps.
        </p>
        {(!hasPhone || !hasEmail) && (
          <p className="text-xs text-warning">
            {!hasPhone && 'No phone on file — SMS steps will be skipped. '}
            {!hasEmail && 'No email on file — email steps will be skipped.'}
          </p>
        )}
        {loadingList ? (
          <p className="text-sm text-muted flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading campaigns…
          </p>
        ) : choices.length === 0 ? (
          <p className="text-sm text-muted">
            {campaigns.length === 0
              ? 'No campaigns yet. Create one under Campaigns.'
              : 'This contact is already enrolled in all available campaigns, or every campaign is archived.'}
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1 min-w-0">
              <label className="block text-xs text-muted mb-1">Campaign</label>
              <Select
                value={campaignId}
                onChange={(e) => {
                  setCampaignId(e.target.value);
                  setMessage(null);
                }}
              >
                <option value="">— Select —</option>
                {choices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.status === 'paused' ? ' (paused)' : ''}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="button" disabled={submitting || !campaignId} onClick={() => void enroll()}>
              {submitting ? 'Enrolling…' : 'Enroll contact'}
            </Button>
          </div>
        )}
        {message && (
          <p className={`text-sm ${message.type === 'ok' ? 'text-success' : 'text-danger'}`} role="status">
            {message.text}
          </p>
        )}
        <RunDueDripsDevButton />
      </CardContent>
    </Card>
  );
}
