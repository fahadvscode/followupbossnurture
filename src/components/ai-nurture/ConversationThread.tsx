'use client';

import { cn } from '@/lib/utils';
import type { DripMessage } from '@/types';

interface Props {
  messages: DripMessage[];
  contactName: string;
}

export function ConversationThread({ messages, contactName }: Props) {
  if (messages.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-8">No messages yet.</p>
    );
  }

  return (
    <div className="space-y-3 py-4">
      {messages.map((msg) => {
        const isOutbound = msg.direction === 'outbound';
        return (
          <div
            key={msg.id}
            className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                isOutbound
                  ? 'bg-accent text-white rounded-br-md'
                  : 'bg-card border border-border text-foreground rounded-bl-md'
              )}
            >
              <p className="whitespace-pre-wrap break-words">{msg.body}</p>
              <p
                className={cn(
                  'mt-1 text-[10px]',
                  isOutbound ? 'text-white/60' : 'text-muted'
                )}
              >
                {isOutbound ? 'AI' : contactName} &middot;{' '}
                {msg.sent_at
                  ? new Date(msg.sent_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : ''}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
