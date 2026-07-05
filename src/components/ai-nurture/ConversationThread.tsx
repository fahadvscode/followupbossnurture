'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { DripMessage } from '@/types';

interface Props {
  messages: DripMessage[];
  contactName: string;
}

export function ConversationThread({ messages, contactName }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  if (messages.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No messages yet.</p>;
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
                'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm sm:max-w-[80%]',
                isOutbound
                  ? 'rounded-br-md bg-accent text-white'
                  : 'rounded-bl-md border border-border bg-card text-foreground'
              )}
            >
              <p className="whitespace-pre-wrap break-words">{msg.body}</p>
              <p
                className={cn(
                  'mt-1 text-[10px]',
                  isOutbound ? 'text-white/60' : 'text-muted'
                )}
              >
                {isOutbound ? 'Sent' : contactName} &middot;{' '}
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
      <div ref={bottomRef} aria-hidden className="h-px shrink-0" />
    </div>
  );
}
