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
    <div
      className={cn(
        'group bg-card border border-border rounded-xl px-5 py-4 shadow-sm transition-colors hover:border-accent/40',
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted">{label}</span>
        {Icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent/15">
            <Icon size={18} />
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{value}</div>
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
