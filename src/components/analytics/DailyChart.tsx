'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { APP_TIMEZONE } from '@/lib/utils';

interface DailyData {
  date: string;
  sent: number;
  replies: number;
}

interface DailyChartProps {
  data: DailyData[];
}

export function DailyChart({ data }: DailyChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={(v) =>
            new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: APP_TIMEZONE })
          }
        />
        <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
        <Tooltip
          contentStyle={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '8px' }}
          labelStyle={{ color: '#e2e8f0' }}
          itemStyle={{ color: '#e2e8f0' }}
          labelFormatter={(v) =>
            new Date(v).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              timeZone: APP_TIMEZONE,
            })
          }
        />
        <Legend wrapperStyle={{ color: '#64748b' }} />
        <Line type="monotone" dataKey="sent" name="Sent" stroke="#3b82f6" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="replies" name="Replies" stroke="#22c55e" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
