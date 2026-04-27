'use client';

import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 disabled:pointer-events-none',
          {
            'bg-accent text-white hover:bg-accent-hover': variant === 'primary',
            'bg-card text-foreground border border-border hover:bg-card-hover': variant === 'secondary',
            'text-muted hover:text-foreground hover:bg-card': variant === 'ghost',
            'bg-danger/10 text-danger hover:bg-danger/20': variant === 'danger',
          },
          {
            'text-xs px-2.5 py-1.5': size === 'sm',
            'text-sm px-4 py-2': size === 'md',
            'text-base px-6 py-3': size === 'lg',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
