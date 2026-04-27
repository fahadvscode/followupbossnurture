'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface CampaignData {
  name: string;
  enrolled: number;
  sent: number;
  replies: number;
  reply_rate: number;
}

interface CampaignComparisonProps {
  data: CampaignData[];
}

export function CampaignComparison({ data }: CampaignComparisonProps) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
        <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
        <Tooltip
          contentStyle={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '8px' }}
          labelStyle={{ color: '#e2e8f0' }}
          itemStyle={{ color: '#e2e8f0' }}
        />
        <Legend wrapperStyle={{ color: '#64748b' }} />
        <Bar dataKey="enrolled" name="Enrolled" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="sent" name="Sent" fill="#6366f1" radius={[4, 4, 0, 0]} />
        <Bar dataKey="replies" name="Replies" fill="#22c55e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
