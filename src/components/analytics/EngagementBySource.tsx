'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface EngagementData {
  source_category: string;
  total: number;
  replied: number;
  engagement_rate: number;
}

interface EngagementBySourceProps {
  data: EngagementData[];
}

export function EngagementBySource({ data }: EngagementBySourceProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="source_category" tick={{ fill: '#64748b', fontSize: 12 }} />
        <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
        <Tooltip
          contentStyle={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '8px' }}
          labelStyle={{ color: '#e2e8f0' }}
          itemStyle={{ color: '#e2e8f0' }}
        />
        <Legend wrapperStyle={{ color: '#64748b' }} />
        <Bar dataKey="total" name="Total Leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="replied" name="Replied" fill="#22c55e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
