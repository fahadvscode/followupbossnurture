import { getServiceClient } from '@/lib/supabase';
import { ContactTimeline } from '@/components/contacts/ContactTimeline';
import { ContactCampaignProgressOverview } from '@/components/contacts/ContactCampaignProgressOverview';
import { ContactEnrollCampaign } from '@/components/contacts/ContactEnrollCampaign';
import { EnrollmentActions } from '@/components/campaigns/EnrollmentActions';
import { FubPersonSync } from '@/components/contacts/FubPersonSync';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPhone, formatDate, formatDateTime, buildStepDayLabelMap } from '@/lib/utils';
import { ArrowLeft, Mail, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type {
  DripContact,
  DripMessage,
  DripEnrollment,
  DripCampaign,
  DripFubNote,
  DripFubEvent,
} from '@/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContactDetailPage({ params }: PageProps) {
  const { id } = await params;
  const db = getServiceClient();

  const { data: contact } = await db
    .from('drip_contacts')
    .select('*')
    .eq('id', id)
    .single();

  if (!contact) notFound();

  const [
    { data: messages },
    { data: enrollments },
    { data: fubNotes },
    { data: fubEvents },
  ] = await Promise.all([
    db.from('drip_messages')
      .select('*')
      .eq('contact_id', id)
      .order('created_at', { ascending: false }),
    db.from('drip_enrollments')
      .select('*, campaign:drip_campaigns(*)')
      .eq('contact_id', id)
      .order('enrolled_at', { ascending: false }),
    db
      .from('drip_fub_notes')
      .select('*')
      .eq('contact_id', id)
      .order('fub_created_at', { ascending: false }),
    db
      .from('drip_fub_events')
      .select('*')
      .eq('contact_id', id)
      .order('occurred_at', { ascending: false }),
  ]);

  const enrollmentCampaignIds = [
    ...new Set((enrollments || []).map((e) => e.campaign_id).filter(Boolean)),
  ] as string[];
  const stepDayLabelsByCampaign: Record<string, Record<number, string>> = {};
  const totalStepsByCampaign: Record<string, number> = {};
  if (enrollmentCampaignIds.length > 0) {
    const { data: stepRows } = await db
      .from('drip_campaign_steps')
      .select('campaign_id, step_number, delay_days, delay_hours, delay_minutes')
      .in('campaign_id', enrollmentCampaignIds);
    for (const cid of enrollmentCampaignIds) {
      const rows = (stepRows || []).filter((r) => r.campaign_id === cid);
      stepDayLabelsByCampaign[cid] = buildStepDayLabelMap(rows);
      totalStepsByCampaign[cid] = rows.length;
    }
  }

  const campaignNames: Record<string, string> = {};
  (enrollments || []).forEach((e) => {
    const campaign = e.campaign as DripCampaign;
    if (campaign) campaignNames[campaign.id] = campaign.name;
  });

  const c = contact as DripContact;
  const customEntries = Object.entries(c.custom_fields || {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== ''
  );
  const notes = (fubNotes || []) as DripFubNote[];
  const events = (fubEvents || []) as DripFubEvent[];

  return (
    <div>
      <Link href="/contacts" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-6">
        <ArrowLeft size={14} /> Back to Contacts
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {`${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown Contact'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {c.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={14} className="text-muted" />
                  <span>{formatPhone(c.phone)}</span>
                </div>
              )}
              {c.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={14} className="text-muted" />
                  <span>{c.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <MapPin size={14} className="text-muted" />
                <Badge variant={c.source_category === 'Facebook' ? 'info' : 'default'}>
                  {c.source_category}
                </Badge>
                {c.source_detail && <span className="text-muted">{c.source_detail}</span>}
              </div>
              {c.stage && (
                <div className="text-sm">
                  <span className="text-muted">Stage:</span> {c.stage}
                </div>
              )}
              {c.assigned_agent && (
                <div className="text-sm">
                  <span className="text-muted">Agent:</span> {c.assigned_agent}
                </div>
              )}
              <div className="text-sm text-muted">
                Added {formatDate(c.created_at)}
              </div>
              {c.fub_last_synced_at && (
                <div className="text-xs text-muted">
                  FUB synced {formatDateTime(c.fub_last_synced_at)}
                </div>
              )}
              {c.opted_out && (
                <Badge variant="danger">Opted Out</Badge>
              )}
            </CardContent>
          </Card>

          {(c.source_url || c.fub_created_via || c.fub_updated_at) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Follow Up Boss source</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {c.source_url && (
                  <div>
                    <span className="text-muted">Source URL</span>
                    <a
                      href={c.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-accent hover:underline break-all mt-0.5"
                    >
                      {c.source_url}
                    </a>
                  </div>
                )}
                {c.fub_created_via && (
                  <div>
                    <span className="text-muted">Created via</span>
                    <p className="mt-0.5">{c.fub_created_via}</p>
                  </div>
                )}
                {c.fub_updated_at && (
                  <div className="text-muted text-xs">
                    Last updated in FUB {formatDateTime(c.fub_updated_at)}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {customEntries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Custom fields</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {customEntries.map(([key, value]) => (
                  <div key={key} className="text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                    <div className="text-muted text-xs font-mono">{key}</div>
                    <div className="mt-0.5 break-words">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {(c.tags || []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {c.tags.map((tag) => (
                    <Badge key={tag} variant="default">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <FubPersonSync contactId={c.id} fubId={c.fub_id} email={c.email} />

          <ContactEnrollCampaign
            contactId={c.id}
            enrolledCampaignIds={(enrollments || []).map((e) => e.campaign_id)}
            hasPhone={Boolean(c.phone?.trim())}
            hasEmail={Boolean(c.email?.trim())}
          />

          {(enrollments || []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaign Enrollments</CardTitle>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Pause, resume, or <strong>restart</strong> (begin again from step 1; delays start from now). When they{' '}
                  <strong>text you back</strong> on your Twilio number, active drips pause until you resume.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {(enrollments || []).map((e) => {
                  const campaign = e.campaign as DripCampaign;
                  const cmap = campaign?.id ? stepDayLabelsByCampaign[campaign.id] : undefined;
                  const lastDayLabel = e.current_step > 0 ? cmap?.[e.current_step] : null;
                  return (
                    <div
                      key={e.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <Link href={`/campaigns/${campaign?.id}`} className="text-sm font-medium hover:text-accent transition-colors">
                          {campaign?.name || 'Unknown Campaign'}
                        </Link>
                        <p className="text-xs text-muted">
                          {lastDayLabel ? `${lastDayLabel} · ` : e.current_step === 0 ? 'Not started · ' : ''}
                          Enrolled {formatDate(e.enrolled_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={
                          e.status === 'active' ? 'success' :
                          e.status === 'completed' ? 'info' :
                          e.status === 'paused' ? 'warning' : 'danger'
                        }>
                          {e.status}
                        </Badge>
                        <EnrollmentActions enrollmentId={e.id} status={e.status} showLabels />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Campaign drip timeline</CardTitle>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Progress per enrollment (which &quot;day&quot; / touch you&apos;re on), what has been sent for each
                campaign, then the full thread including inbound replies below.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <ContactCampaignProgressOverview
                enrollments={(enrollments || []) as (DripEnrollment & { campaign: DripCampaign | null })[]}
                stepDayLabelsByCampaign={stepDayLabelsByCampaign}
                totalStepsByCampaign={totalStepsByCampaign}
                messages={(messages || []) as DripMessage[]}
              />
              <div className="border-t border-border pt-5">
                <h3 className="text-sm font-medium text-foreground mb-3">All messages &amp; replies</h3>
                <ContactTimeline
                  messages={(messages || []) as DripMessage[]}
                  campaignNames={campaignNames}
                  stepDayLabelsByCampaign={stepDayLabelsByCampaign}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Follow Up Boss notes</CardTitle>
            </CardHeader>
            <CardContent>
              {notes.length === 0 ? (
                <p className="text-sm text-muted">
                  No notes stored yet. They sync when this lead is updated via the Follow Up Boss webhook (full sync).
                </p>
              ) : (
                <ul className="space-y-4">
                  {notes.map((n) => (
                    <li key={n.id} className="border-b border-border/40 pb-4 last:border-0 last:pb-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{n.subject || 'Note'}</span>
                        <span className="text-xs text-muted">
                          {n.fub_created_at ? formatDateTime(n.fub_created_at) : ''}
                        </span>
                      </div>
                      {n.created_by && (
                        <p className="text-xs text-muted mt-1">By {n.created_by}</p>
                      )}
                      {n.body && (
                        <div className="text-sm mt-2 whitespace-pre-wrap text-foreground/90">
                          {n.is_html ? n.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : n.body}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Follow Up Boss activity</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted">
                  No activity history stored yet. It syncs on webhook with notes and the full person record.
                </p>
              ) : (
                <ul className="space-y-3">
                  {events.map((ev) => (
                    <li key={ev.id} className="text-sm border-l-2 border-accent/40 pl-3">
                      <div className="flex flex-wrap gap-2 items-baseline">
                        {ev.event_type && (
                          <Badge variant="info">{ev.event_type}</Badge>
                        )}
                        <span className="text-xs text-muted">
                          {ev.occurred_at ? formatDateTime(ev.occurred_at) : ''}
                        </span>
                      </div>
                      {ev.message && <p className="mt-1">{ev.message}</p>}
                      {ev.description && (
                        <p className="mt-1 text-muted text-xs">{ev.description}</p>
                      )}
                      {ev.event_source && (
                        <p className="text-xs text-muted mt-1">Source: {ev.event_source}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {c.fub_snapshot && Object.keys(c.fub_snapshot).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Raw FUB record</CardTitle>
              </CardHeader>
              <CardContent>
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted hover:text-foreground">
                    Expand JSON snapshot from Follow Up Boss
                  </summary>
                  <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap">
                    {JSON.stringify(c.fub_snapshot, null, 2)}
                  </pre>
                </details>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
