import { getServiceClient } from '@/lib/supabase';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DeliveryIssuesCard } from '@/components/dashboard/DeliveryIssuesCard';
import { DashboardConfigError } from '@/components/dashboard/DashboardConfigError';
import { Users, MessageSquare, Zap, MessageCircle, ArrowUpRight } from 'lucide-react';
import { formatDateTime, percentage, startOfAppDayUtcIso } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getDashboardStats() {
  const db = getServiceClient();

  const hours24ago = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const days7ago = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const days14ago = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [contacts, activeEnrollments, messages, replies, todayMessages, campaigns, deliveredLast24h, failedLast7d] =
    await Promise.all([
    db.from('drip_contacts').select('id', { count: 'exact', head: true }),
    db.from('drip_enrollments').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('drip_messages').select('id', { count: 'exact', head: true }).eq('direction', 'outbound'),
    db.from('drip_messages').select('id', { count: 'exact', head: true }).eq('direction', 'inbound'),
    db.from('drip_messages').select('id', { count: 'exact', head: true })
      .eq('direction', 'outbound')
      .gte('sent_at', startOfAppDayUtcIso()),
    db.from('drip_campaigns').select('id, name, status', { count: 'exact' }).eq('status', 'active'),
    db
      .from('drip_messages')
      .select('id', { count: 'exact', head: true })
      .eq('direction', 'outbound')
      .eq('status', 'delivered')
      .gte('sent_at', hours24ago),
    db
      .from('drip_messages')
      .select('id', { count: 'exact', head: true })
      .eq('direction', 'outbound')
      .eq('status', 'failed')
      .gte('created_at', days7ago),
  ]);

  const recentMessages = await db
    .from('drip_messages')
    .select('*, contact:drip_contacts(first_name, last_name, phone), campaign:drip_campaigns(name)')
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: deliveryIssues } = await db
    .from('drip_messages')
    .select(
      'id, body, status, channel, error_detail, sent_at, created_at, step_number, twilio_sid, contact_id, contact:drip_contacts(first_name, last_name, phone), campaign:drip_campaigns(name)'
    )
    .eq('direction', 'outbound')
    .eq('status', 'failed')
    .gte('created_at', days14ago)
    .order('sent_at', { ascending: false })
    .limit(15);

  return {
    totalContacts: contacts.count || 0,
    activeDrips: activeEnrollments.count || 0,
    totalSent: messages.count || 0,
    totalReplies: replies.count || 0,
    todaySent: todayMessages.count || 0,
    activeCampaigns: campaigns.count || 0,
    replyRate: percentage(replies.count || 0, messages.count || 0),
    recentActivity: recentMessages.data || [],
    deliveryIssues: deliveryIssues || [],
    deliveredLast24h: deliveredLast24h.count || 0,
    failedLast7d: failedLast7d.count || 0,
  };
}

export default async function DashboardPage() {
  let stats: Awaited<ReturnType<typeof getDashboardStats>>;
  try {
    stats = await getDashboardStats();
  } catch (e) {
    console.error('Dashboard getDashboardStats failed:', e);
    const hint =
      process.env.NODE_ENV === 'development' && e instanceof Error ? e.message : undefined;
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        </div>
        <DashboardConfigError hint={hint} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted mt-1">Your SMS drip campaign overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Contacts"
          value={stats.totalContacts.toLocaleString()}
          icon={Users}
        />
        <StatCard
          label="Active Drips"
          value={stats.activeDrips.toLocaleString()}
          icon={Zap}
        />
        <StatCard
          label="Sent Today"
          value={stats.todaySent.toLocaleString()}
          icon={MessageSquare}
        />
        <StatCard
          label="Reply Rate"
          value={stats.replyRate}
          icon={MessageCircle}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Recent activity</CardTitle>
                <Link href="/analytics" className="text-xs text-accent hover:text-accent-hover flex items-center gap-1 shrink-0">
                  View all <ArrowUpRight size={12} />
                </Link>
              </div>
              <p className="text-xs text-muted mt-1">Latest messages across contacts and campaigns</p>
            </CardHeader>
            <CardContent className="p-0">
              {stats.recentActivity.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-muted">
                  No activity yet. Sync contacts and create your first campaign to get started.
                </div>
              ) : (
                <div className="border-t border-border">
                  <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_5.5rem_7rem_auto] gap-2 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted bg-muted/30 border-b border-border">
                    <span>Lead &amp; preview</span>
                    <span>Campaign</span>
                    <span className="text-right sm:text-left">Status</span>
                    <span className="text-right">Time</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {stats.recentActivity.map((msg) => {
                      const contact = msg.contact as { first_name: string; last_name: string; phone: string } | null;
                      const campaign = msg.campaign as { name: string } | null;
                      const leadName = contact
                        ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.phone
                        : 'Unknown';
                      const statusLabel =
                        msg.direction === 'inbound'
                          ? 'Reply'
                          : msg.status === 'failed'
                            ? 'Failed'
                            : msg.status === 'delivered'
                              ? 'Delivered'
                              : 'Sent';
                      const preview = (msg.body || '').trim() || '—';

                      return (
                        <li key={msg.id} className="px-4 py-2.5 sm:py-2">
                          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_5.5rem_7rem_auto] sm:items-center gap-2 sm:gap-2">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span
                                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${msg.direction === 'inbound' ? 'bg-success' : 'bg-accent'}`}
                                aria-hidden
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{leadName}</p>
                                <p className="text-xs text-muted line-clamp-1 mt-0.5" title={preview}>
                                  {preview}
                                </p>
                              </div>
                            </div>
                            <div className="pl-4 sm:pl-0 min-w-0">
                              <span className="sm:hidden text-[10px] uppercase tracking-wide text-muted">Campaign </span>
                              {campaign ? (
                                <span className="text-xs text-muted truncate block max-w-full" title={campaign.name}>
                                  {campaign.name}
                                </span>
                              ) : (
                                <span className="text-xs text-muted">—</span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2 sm:justify-start pl-4 sm:pl-0">
                              <span className="sm:hidden text-[10px] uppercase tracking-wide text-muted">Status </span>
                              <Badge
                                variant={msg.direction === 'inbound' ? 'success' : msg.status === 'failed' ? 'danger' : 'default'}
                                className="text-[10px] px-1.5 py-0 shrink-0"
                              >
                                {statusLabel}
                              </Badge>
                            </div>
                            <div className="text-right pl-4 sm:pl-0">
                              <time className="text-[11px] text-muted tabular-nums whitespace-nowrap">
                                {formatDateTime(msg.created_at)}
                              </time>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <DeliveryIssuesCard
            issues={stats.deliveryIssues}
            deliveredLast24h={stats.deliveredLast24h}
            failedLast7d={stats.failedLast7d}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted">Total Messages Sent</span>
                <span className="text-sm font-medium text-foreground">{stats.totalSent.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">Total Replies</span>
                <span className="text-sm font-medium text-foreground">{stats.totalReplies.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">Active Campaigns</span>
                <span className="text-sm font-medium text-foreground">{stats.activeCampaigns}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted">Reply Rate</span>
                <span className="text-sm font-medium text-success">{stats.replyRate}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
