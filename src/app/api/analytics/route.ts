import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { dateKeyInAppTimezone } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const db = getServiceClient();
  const type = request.nextUrl.searchParams.get('type');

  if (type === 'source_breakdown') {
    const { data: contacts } = await db
      .from('drip_contacts')
      .select('source_category');

    const breakdown: Record<string, number> = {};
    (contacts || []).forEach((c) => {
      const cat = c.source_category || 'Other';
      breakdown[cat] = (breakdown[cat] || 0) + 1;
    });

    return NextResponse.json(
      Object.entries(breakdown)
        .map(([source_category, count]) => ({ source_category, count }))
        .sort((a, b) => b.count - a.count)
    );
  }

  if (type === 'engagement_by_source') {
    const { data: contacts } = await db
      .from('drip_contacts')
      .select('id, source_category');

    const { data: replies } = await db
      .from('drip_messages')
      .select('contact_id')
      .eq('direction', 'inbound');

    const replyContactIds = new Set((replies || []).map(r => r.contact_id));

    const sourceStats: Record<string, { total: number; replied: number }> = {};
    (contacts || []).forEach((c) => {
      const cat = c.source_category || 'Other';
      if (!sourceStats[cat]) sourceStats[cat] = { total: 0, replied: 0 };
      sourceStats[cat].total++;
      if (replyContactIds.has(c.id)) sourceStats[cat].replied++;
    });

    return NextResponse.json(
      Object.entries(sourceStats).map(([source, stats]) => ({
        source_category: source,
        total: stats.total,
        replied: stats.replied,
        engagement_rate: stats.total > 0 ? +(stats.replied / stats.total * 100).toFixed(1) : 0,
      }))
    );
  }

  if (type === 'campaign_comparison') {
    const { data: campaigns } = await db
      .from('drip_campaigns')
      .select('id, name, status');

    const results = await Promise.all(
      (campaigns || []).map(async (campaign) => {
        const [enrolled, sent, replies] = await Promise.all([
          db.from('drip_enrollments').select('id', { count: 'exact', head: true }).eq('campaign_id', campaign.id),
          db.from('drip_messages').select('id', { count: 'exact', head: true }).eq('campaign_id', campaign.id).eq('direction', 'outbound'),
          db.from('drip_messages').select('id', { count: 'exact', head: true }).eq('campaign_id', campaign.id).eq('direction', 'inbound'),
        ]);

        return {
          name: campaign.name,
          status: campaign.status,
          enrolled: enrolled.count || 0,
          sent: sent.count || 0,
          replies: replies.count || 0,
          reply_rate: (sent.count || 0) > 0 ? +((replies.count || 0) / (sent.count || 0) * 100).toFixed(1) : 0,
        };
      })
    );

    return NextResponse.json(results);
  }

  if (type === 'daily_messages') {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: messages } = await db
      .from('drip_messages')
      .select('direction, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const dailyData: Record<string, { sent: number; replies: number }> = {};
    (messages || []).forEach((m) => {
      const day = dateKeyInAppTimezone(m.created_at);
      if (!dailyData[day]) dailyData[day] = { sent: 0, replies: 0 };
      if (m.direction === 'outbound') dailyData[day].sent++;
      else dailyData[day].replies++;
    });

    return NextResponse.json(
      Object.entries(dailyData)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date))
    );
  }

  if (type === 'cross_source_overlap') {
    const { data: contacts } = await db
      .from('drip_contacts')
      .select('id, first_name, last_name, source, source_category, tags');

    const cleanHints = [
      { label: 'Facebook', test: (b: string) => /facebook|\bfb\b|meta ads/i.test(b) },
      { label: 'Google', test: (b: string) => /google|adwords|gclid/i.test(b) },
      { label: 'Website', test: (b: string) => /website|organic|homepage/i.test(b) },
      { label: 'Email Signup', test: (b: string) => /email|newsletter|mailchimp|signup/i.test(b) },
      { label: 'Landing Page', test: (b: string) => /landing|cornerstone|novella|lp_/i.test(b) },
    ];

    const overlaps: {
      id: string;
      name: string;
      source_category: string;
      channels: string[];
    }[] = [];

    for (const c of contacts || []) {
      const tags = Array.isArray(c.tags) ? c.tags : [];
      const blob = [c.source || '', c.source_category || '', ...tags].join(' ');
      const detected = new Set<string>();
      if (c.source_category) detected.add(c.source_category as string);
      for (const h of cleanHints) {
        if (h.test(blob)) detected.add(h.label);
      }
      if (detected.size >= 2) {
        overlaps.push({
          id: c.id,
          name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
          source_category: c.source_category || 'Other',
          channels: [...detected].sort(),
        });
      }
    }

    return NextResponse.json({
      count: overlaps.length,
      contacts: overlaps.slice(0, 40),
    });
  }

  if (type === 'funnel') {
    const [total, enrolled, replied, engaged] = await Promise.all([
      db.from('drip_contacts').select('id', { count: 'exact', head: true }),
      db.from('drip_enrollments').select('contact_id', { count: 'exact', head: true }),
      db.from('drip_messages').select('contact_id', { count: 'exact', head: true }).eq('direction', 'inbound'),
      db.from('drip_enrollments').select('id', { count: 'exact', head: true }).in('status', ['completed', 'paused']),
    ]);

    return NextResponse.json([
      { stage: 'Total Leads', value: total.count || 0 },
      { stage: 'Enrolled in Drip', value: enrolled.count || 0 },
      { stage: 'Replied', value: replied.count || 0 },
      { stage: 'Engaged', value: engaged.count || 0 },
    ]);
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
}
