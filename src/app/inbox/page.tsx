'use client';

import { Inbox } from 'lucide-react';

export default function InboxPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <Inbox size={36} className="mb-3 text-muted" />
      <h2 className="text-lg font-semibold text-foreground">Select a conversation</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Open a thread from the list. New messages stay visible on the left so nothing is missed
        while you reply.
      </p>
    </div>
  );
}
