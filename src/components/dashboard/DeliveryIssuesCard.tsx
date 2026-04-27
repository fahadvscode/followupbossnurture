import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { inferMessageChannel, summarizeErrorDetail } from '@/lib/delivery-error-meta';
import { AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';

type ContactEmbed = { id?: string; first_name: string | null; last_name: string | null; phone: string | null };
type CampaignEmbed = { id?: string; name: string | null };

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export type IssueRow = {
  id: string;
  body: string;
  status: string;
  channel?: string | null;
  error_detail?: unknown;
  sent_at: string | null;
  created_at: string;
  step_number: number | null;
  twilio_sid: string | null;
  contact_id: string;
  contact: ContactEmbed | ContactEmbed[] | null;
  campaign: CampaignEmbed | CampaignEmbed[] | null;
};

interface DeliveryIssuesCardProps {
  issues: IssueRow[];
  deliveredLast24h: number;
  failedLast7d: number;
}

const channelLabel: Record<string, string> = {
  sms: 'SMS',
  email: 'Email',
  fub_task: 'FUB task',
  fub_action_plan: 'FUB plan',
};

export function DeliveryIssuesCard({ issues, deliveredLast24h, failedLast7d }: DeliveryIssuesCardProps) {
  const hasIssues = issues.length > 0;

  return (
    <Card
      className={
        hasIssues
          ? 'border-danger/25 bg-danger/[0.03]'
          : 'border-border'
      }
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle size={17} className="text-danger shrink-0" />
            Delivery &amp; send diagnostics
          </CardTitle>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1 text-success">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>
                24h delivered: <strong className="text-foreground">{deliveredLast24h}</strong>
              </span>
            </span>
            <span className="inline-flex items-center gap-1 text-danger">
              <AlertTriangle size={13} className="shrink-0" />
              <span>
                7d failed: <strong className="text-foreground">{failedLast7d}</strong>
              </span>
            </span>
          </div>
        </div>
        <details className="group mt-2 text-xs text-muted [&_summary::-webkit-details-marker]:hidden">
          <summary className="cursor-pointer select-none text-muted hover:text-foreground underline-offset-2 hover:underline">
            How this panel works
          </summary>
          <p className="mt-2 leading-relaxed pl-0 border-l-2 border-border pl-3">
            SMS delivery updates use Twilio&apos;s status webhook. Send-time failures (Twilio API, Follow Up Boss,
            SMTP, or config) are stored when the drip runner runs the step.
          </p>
        </details>
      </CardHeader>
      <CardContent className="pt-0">
        {!hasIssues ? (
          <p className="text-sm text-muted py-1">
            No failed outbound messages in the last 14 days. If texts still don&apos;t arrive, set Twilio status
            callback to <code className="text-[11px] px-1 rounded bg-muted">/api/webhooks/twilio/status</code> and
            check the lead timeline in Follow Up Boss.
          </p>
        ) : (
          <details className="group/details rounded-lg border border-border bg-card/80 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/40 rounded-lg">
              <span className="min-w-0 truncate">
                Review <span className="text-danger">{issues.length}</span> failed send
                {issues.length === 1 ? '' : 's'} (14 days)
              </span>
              <ChevronDown
                size={16}
                className="shrink-0 text-muted transition-transform duration-200 group-open/details:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="border-t border-border px-2 py-2 max-h-[min(22rem,55vh)] overflow-y-auto">
              <ul className="space-y-2">
                {issues.map((msg) => {
                  const contact = one(msg.contact);
                  const campaign = one(msg.campaign);
                  const name =
                    `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim() || 'Contact';
                  const ch = inferMessageChannel({
                    body: msg.body,
                    channel: msg.channel,
                    twilio_sid: msg.twilio_sid,
                  });
                  const chName = channelLabel[ch] || ch;
                  const summary = summarizeErrorDetail(msg.error_detail);
                  const when = formatDateTime(msg.sent_at || msg.created_at);

                  return (
                    <li
                      key={msg.id}
                      className="rounded-md border border-border/80 bg-background px-3 py-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <Badge variant="danger" className="text-[10px] px-1.5 py-0">
                            failed
                          </Badge>
                          <span className="text-muted">{chName}</span>
                          {msg.step_number != null && (
                            <span className="text-muted">· Step {msg.step_number}</span>
                          )}
                          {campaign?.name && (
                            <Badge variant="info" className="text-[10px] px-1.5 py-0 max-w-[8rem] truncate">
                              {campaign.name}
                            </Badge>
                          )}
                        </div>
                        <time className="shrink-0 text-[11px] text-muted tabular-nums">{when}</time>
                      </div>
                      <p className="mt-1.5 text-sm text-foreground leading-snug">
                        <Link
                          href={`/contacts/${msg.contact_id}`}
                          className="font-medium text-accent hover:text-accent-hover"
                        >
                          {name}
                        </Link>
                        {contact?.phone && (
                          <span className="text-muted font-normal"> · {contact.phone}</span>
                        )}
                      </p>
                      {summary && (
                        <p className="mt-1 text-[11px] text-danger/90 leading-snug line-clamp-2" title={summary}>
                          {summary}
                        </p>
                      )}
                      {!summary && msg.error_detail == null && (
                        <p className="mt-1 text-[11px] text-muted">No error payload stored.</p>
                      )}
                      {msg.twilio_sid && (
                        <p className="mt-1 text-[10px] text-muted font-mono truncate" title={msg.twilio_sid}>
                          SID {msg.twilio_sid}
                        </p>
                      )}
                      {msg.error_detail != null && typeof msg.error_detail === 'object' ? (
                        <details className="mt-1.5 text-[11px]">
                          <summary className="cursor-pointer text-muted hover:text-foreground select-none">
                            Raw error_detail
                          </summary>
                          <pre className="mt-1.5 max-h-28 overflow-auto rounded bg-muted/50 p-2 font-mono text-[10px] whitespace-pre-wrap break-all">
                            {JSON.stringify(msg.error_detail, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
