import { getServiceClient } from '@/lib/supabase';
import { EnrollmentTable } from '@/components/campaigns/EnrollmentTable';
import { ReplyFeed } from '@/components/campaigns/ReplyFeed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { CampaignControls } from '@/components/campaigns/CampaignControls';
import { ArrowLeft, Edit, Users, MessageSquare, MessageCircle, CheckCircle } from 'lucide-react';
import {
  percentage,
  formatDate,
  formatPhone,
  formatDripStepDayLabel,
  buildStepDayLabelMap,
} from '@/lib/utils';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { DripCampaign, DripCampaignStep, DripContact, DripEnrollment, DripMessage } from '@/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({ params }: PageProps) {
  const { id } = await params;
  const db = getServiceClient();

  const { data: campaign } = await db
    .from('drip_campaigns')
    .select('*')
    .eq('id', id)
    .single();

  if (!campaign) notFound();

  const [
    { data: steps },
    { data: enrollments },
    { data: allMessages },
  ] = await Promise.all([
    db.from('drip_campaign_steps')
      .select('*')
      .eq('campaign_id', id)
      .order('step_number', { ascending: true }),
    db.from('drip_enrollments')
      .select('*, contact:drip_contacts(*)')
      .eq('campaign_id', id)
      .order('enrolled_at', { ascending: false }),
    db.from('drip_messages')
      .select('*, contact:drip_contacts(*)')
      .eq('campaign_id', id)
      .order('created_at', { ascending: false }),
  ]);

  const typedEnrollments = (enrollments || []) as (DripEnrollment & { contact: DripContact })[];
  const typedMessages = (allMessages || []) as (DripMessage & { contact?: DripContact })[];
  const typedSteps = (steps || []) as DripCampaignStep[];

  const totalEnrolled = typedEnrollments.length;
  const activeCount = typedEnrollments.filter(e => e.status === 'active').length;
  const completedCount = typedEnrollments.filter(e => e.status === 'completed').length;
  const pausedCount = typedEnrollments.filter(e => e.status === 'paused').length;
  const optedOutCount = typedEnrollments.filter(e => e.status === 'opted_out').length;

  const outboundMessages = typedMessages.filter(m => m.direction === 'outbound');
  const replies = typedMessages.filter(m => m.direction === 'inbound');

  const stepDayLabels = buildStepDayLabelMap(typedSteps);

  const stepPerformance = typedSteps.map((step) => {
    const stepSent = outboundMessages.filter((m) => m.step_number === step.step_number);
    const stepReplies = replies.filter((m) => m.step_number === step.step_number);
    const kind =
      step.step_type === 'fub_task'
        ? 'task'
        : step.step_type === 'fub_action_plan'
          ? 'action_plan'
          : step.step_type === 'email'
            ? 'email'
            : 'sms';
    const template =
      step.step_type === 'fub_task'
        ? (step.fub_task_name_template || step.message_template || '—')
        : step.step_type === 'fub_action_plan'
          ? (step.fub_task_name_template || `Action Plan #${step.fub_action_plan_id}`)
          : step.step_type === 'email'
            ? (step.email_subject_template || step.message_template || '—')
            : step.message_template;
    const delayMinutes = Number((step as { delay_minutes?: number }).delay_minutes) || 0;
    return {
      step_number: step.step_number,
      dayLabel: formatDripStepDayLabel({
        delay_days: Number(step.delay_days) || 0,
        delay_hours: Number(step.delay_hours) || 0,
        delay_minutes: delayMinutes,
      }),
      kind,
      delay_days: Number(step.delay_days) || 0,
      delay_hours: Number(step.delay_hours) || 0,
      delay_minutes: delayMinutes,
      template,
      sent: stepSent.length,
      delivered: stepSent.filter((m) => m.status === 'delivered').length,
      failed: stepSent.filter((m) => m.status === 'failed').length,
      replies: stepReplies.length,
      reply_rate: percentage(stepReplies.length, stepSent.length),
    };
  });

  const c = campaign as DripCampaign;

  return (
    <div>
      <Link href="/campaigns" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-6">
        <ArrowLeft size={14} /> Back to Campaigns
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{c.name}</h1>
            <Badge variant={c.status === 'active' ? 'success' : c.status === 'paused' ? 'warning' : 'default'}>
              {c.status}
            </Badge>
          </div>
          {c.description && <p className="text-sm text-muted mt-1">{c.description}</p>}
          <p className="text-sm text-muted mt-2">
            <span className="text-foreground/80">Sends from:</span>{' '}
            {c.twilio_from_number
              ? formatPhone(c.twilio_from_number) + ` (${c.twilio_from_number})`
              : 'Default TWILIO_PHONE_NUMBER in env'}
          </p>
          <div className="mt-3">
            <CampaignControls campaignId={id} status={c.status} />
          </div>
        </div>
        <Link href={`/campaigns/${id}/edit`}>
          <Button variant="secondary">
            <Edit size={14} className="mr-2" /> Edit
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="Total Enrolled" value={totalEnrolled} icon={Users} />
        <StatCard label="Active" value={activeCount} icon={MessageSquare} />
        <StatCard label="Paused" value={pausedCount} icon={MessageSquare} />
        <StatCard label="Completed" value={completedCount} icon={CheckCircle} />
        <StatCard label="Opted Out" value={optedOutCount} icon={MessageCircle} />
        <StatCard label="Reply Rate" value={percentage(replies.length, outboundMessages.length)} icon={MessageCircle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance by day</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 text-xs font-medium text-muted uppercase">Day</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted uppercase">Type</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted uppercase">Delay</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted uppercase">Outbound</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted uppercase">Delivered</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted uppercase">Replies</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted uppercase">Reply rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stepPerformance.map((sp) => (
                    <tr key={sp.step_number} className="hover:bg-card-hover transition-colors">
                      <td className="px-4 py-3 text-sm font-medium max-w-[220px]">
                        <span className="block text-base font-semibold text-foreground tracking-tight">
                          {sp.dayLabel}
                        </span>
                        <span className="text-[11px] text-muted font-normal line-clamp-2 mt-0.5">
                          {sp.template}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge
                          variant={
                            sp.kind === 'task'
                              ? 'info'
                              : sp.kind === 'action_plan'
                                ? 'success'
                                : sp.kind === 'email'
                                  ? 'warning'
                                  : 'default'
                          }
                        >
                          {sp.kind === 'task'
                            ? 'FUB task'
                            : sp.kind === 'action_plan'
                              ? 'Action Plan'
                              : sp.kind === 'email'
                                ? 'Email'
                                : 'SMS'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted whitespace-nowrap font-mono text-xs">
                        {sp.delay_days}d {sp.delay_hours}h {sp.delay_minutes}m
                      </td>
                      <td className="px-4 py-3 text-sm">{sp.sent}</td>
                      <td className="px-4 py-3 text-sm text-success">{sp.delivered}</td>
                      <td className="px-4 py-3 text-sm text-accent">{sp.replies}</td>
                      <td className="px-4 py-3 text-sm font-medium">{sp.reply_rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enrolled Contacts ({totalEnrolled})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {typedEnrollments.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-muted">
                  No contacts enrolled yet.
                </div>
              ) : (
                <EnrollmentTable
                  enrollments={typedEnrollments}
                  totalSteps={typedSteps.length}
                  stepDayLabels={stepDayLabels}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Replies ({replies.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ReplyFeed replies={replies} stepDayLabels={stepDayLabels} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
