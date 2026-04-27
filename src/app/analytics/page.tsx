'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { CampaignComparison } from '@/components/analytics/CampaignComparison';
import { DailyChart } from '@/components/analytics/DailyChart';
import { BarChart3, MessageSquare, MessageCircle, TrendingUp, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CampaignData {
  name: string;
  status: string;
  enrolled: number;
  sent: number;
  replies: number;
  reply_rate: number;
}

interface DailyData {
  date: string;
  sent: number;
  replies: number;
}

export default function AnalyticsPage() {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/analytics?type=campaign_comparison').then(r => r.json()),
      fetch('/api/analytics?type=daily_messages').then(r => r.json()),
    ]).then(([campaignData, daily]) => {
      setCampaigns(campaignData);
      setDailyData(daily);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  const totalSent = campaigns.reduce((sum, c) => sum + c.sent, 0);
  const totalReplies = campaigns.reduce((sum, c) => sum + c.replies, 0);
  const overallReplyRate = totalSent > 0 ? ((totalReplies / totalSent) * 100).toFixed(1) : '0';
  const totalEnrolled = campaigns.reduce((sum, c) => sum + c.enrolled, 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted mt-1">Campaign performance and messaging trends</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Enrolled" value={totalEnrolled.toLocaleString()} icon={BarChart3} />
        <StatCard label="Messages Sent" value={totalSent.toLocaleString()} icon={MessageSquare} />
        <StatCard label="Total Replies" value={totalReplies.toLocaleString()} icon={MessageCircle} />
        <StatCard label="Overall Reply Rate" value={`${overallReplyRate}%`} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Message Trends (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <DailyChart data={dailyData} />
            ) : (
              <div className="text-center py-10 text-sm text-muted">No messaging data yet. Start sending campaigns to see trends.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            {campaigns.length > 0 ? (
              <CampaignComparison data={campaigns} />
            ) : (
              <div className="text-center py-10 text-sm text-muted">No campaign data yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance Table</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {campaigns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 text-xs font-medium text-muted uppercase">Campaign</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted uppercase">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted uppercase">Enrolled</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted uppercase">Sent</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted uppercase">Replies</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted uppercase">Reply Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.name} className="hover:bg-card-hover transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{campaign.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant={campaign.status === 'active' ? 'success' : campaign.status === 'paused' ? 'warning' : 'default'}>
                          {campaign.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">{campaign.enrolled}</td>
                      <td className="px-4 py-3 text-sm">{campaign.sent}</td>
                      <td className="px-4 py-3 text-sm text-success">{campaign.replies}</td>
                      <td className="px-4 py-3 text-sm font-medium">{campaign.reply_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-10 text-center text-sm text-muted">Create campaigns to see performance data.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
