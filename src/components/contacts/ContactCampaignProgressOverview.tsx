import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatDateTime } from '@/lib/utils';
import type { DripCampaign, DripEnrollment, DripMessage } from '@/types';

type EnrollmentWithCampaign = DripEnrollment & { campaign: DripCampaign | null };

interface ContactCampaignProgressOverviewProps {
  enrollments: EnrollmentWithCampaign[];
  stepDayLabelsByCampaign: Record<string, Record<number, string>>;
  totalStepsByCampaign: Record<string, number>;
  messages: DripMessage[];
}

function progressNarrative(
  e: DripEnrollment,
  total: number,
  labels: Record<number, string>
): { primary: string; secondary: string | null } {
  if (total === 0) {
    return {
      primary: 'This campaign has no steps yet.',
      secondary: null,
    };
  }

  if (e.status === 'completed') {
    return {
      primary: `Finished all ${total} touch${total === 1 ? '' : 'es'}.`,
      secondary:
        e.current_step > 0
          ? `Last: ${labels[e.current_step] ?? `Step ${e.current_step}`}`
          : null,
    };
  }

  if (e.current_step === 0) {
    const upNext = labels[1] ?? 'Step 1';
    return {
      primary: `Not started — up next: ${upNext}.`,
      secondary: `Enrolled ${formatDate(e.enrolled_at)}`,
    };
  }

  const lastL = labels[e.current_step] ?? `Step ${e.current_step}`;
  const nextNum = e.current_step + 1;
  if (nextNum > total) {
    return { primary: `Last sent: ${lastL}.`, secondary: 'Waiting to mark complete.' };
  }
  const nextL = labels[nextNum] ?? `Step ${nextNum}`;
  return {
    primary: `Last touch sent: ${lastL}.`,
    secondary: `Up next (when drip runs): ${nextL} · ${e.current_step} of ${total} completed`,
  };
}

export function ContactCampaignProgressOverview({
  enrollments,
  stepDayLabelsByCampaign,
  totalStepsByCampaign,
  messages,
}: ContactCampaignProgressOverviewProps) {
  if (enrollments.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card/40 px-4 py-3 text-sm text-muted">
        No campaign enrollments — enroll this lead to see drip progress here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {enrollments.map((e) => {
        const campaign = e.campaign;
        const cid = e.campaign_id;
        const total = totalStepsByCampaign[cid] ?? 0;
        const labels = stepDayLabelsByCampaign[cid] || {};
        const { primary, secondary } = progressNarrative(e, total, labels);
        const pct = total > 0 ? Math.min(100, (e.current_step / total) * 100) : 0;

        const outbound = messages.filter(
          (m) => m.campaign_id === cid && m.direction === 'outbound'
        );
        const sortedOutbound = [...outbound].sort(
          (a, b) =>
            new Date(a.sent_at || a.created_at).getTime() -
            new Date(b.sent_at || b.created_at).getTime()
        );

        return (
          <div
            key={e.id}
            className="rounded-lg border border-border bg-card-hover/50 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link
                  href={`/campaigns/${cid}`}
                  className="text-sm font-semibold text-foreground hover:text-accent transition-colors"
                >
                  {campaign?.name || 'Campaign'}
                </Link>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">{primary}</p>
                {secondary && <p className="text-xs text-muted/90 mt-1">{secondary}</p>}
              </div>
              <Badge
                variant={
                  e.status === 'active'
                    ? 'success'
                    : e.status === 'completed'
                      ? 'info'
                      : e.status === 'paused'
                        ? 'warning'
                        : 'danger'
                }
              >
                {e.status}
              </Badge>
            </div>

            {total > 0 && (
              <div>
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>Campaign progress</span>
                  <span>
                    {e.current_step} / {total} touches
                  </span>
                </div>
                <div className="h-2 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
                Sent on this campaign
              </p>
              {sortedOutbound.length === 0 ? (
                <p className="text-xs text-muted">No outbound messages logged yet for this campaign.</p>
              ) : (
                <ul className="space-y-2">
                  {sortedOutbound.map((m) => (
                    <li
                      key={m.id}
                      className="text-xs border-l-2 border-accent/40 pl-3 py-1"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-muted">
                        {m.step_number != null && (
                          <span className="text-foreground font-medium">
                            {labels[m.step_number] ?? `Step ${m.step_number}`}
                          </span>
                        )}
                        <Badge
                          variant={
                            m.status === 'failed'
                              ? 'danger'
                              : m.status === 'delivered' || m.status === 'sent'
                                ? 'success'
                                : 'default'
                          }
                        >
                          {m.status}
                        </Badge>
                        <span>{formatDateTime(m.sent_at || m.created_at)}</span>
                      </div>
                      <p className="text-sm text-foreground/90 mt-1 line-clamp-3 whitespace-pre-wrap">
                        {m.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
