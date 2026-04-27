'use client';

import { cn } from '@/lib/utils';
import { TextareaHTMLAttributes, forwardRef } from 'react';

const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors min-h-[80px] resize-y',
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
