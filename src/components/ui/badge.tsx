import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
        {
          'bg-foreground/10 text-foreground': variant === 'default',
          'bg-success/15 text-success': variant === 'success',
          'bg-warning/15 text-warning': variant === 'warning',
          'bg-danger/15 text-danger': variant === 'danger',
          'bg-accent/15 text-accent': variant === 'info',
        },
        className
      )}
      {...props}
    />
  );
}
