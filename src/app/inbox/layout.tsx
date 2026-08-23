import { InboxShell } from '@/components/inbox/InboxShell';

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return <InboxShell>{children}</InboxShell>;
}
