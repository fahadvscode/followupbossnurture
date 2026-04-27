import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: LucideIcon;
  className?: string;
}

export function StatCard({ label, value, change, trend, icon: Icon, className }: StatCardProps) {
  return (
    <div className={cn('bg-card border border-border rounded-xl px-5 py-4', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted">{label}</span>
        {Icon && <Icon size={18} className="text-muted" />}
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {change && (
        <div className={cn('text-xs mt-1', {
          'text-success': trend === 'up',
          'text-danger': trend === 'down',
          'text-muted': trend === 'neutral',
        })}>
          {change}
        </div>
      )}
    </div>
  );
}
