'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Brain,
  BarChart3,
  LogOut,
  Zap,
  FileStack,
  Sparkles,
  Menu,
  X,
  Inbox,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/campaigns', label: 'Campaigns', icon: MessageSquare },
  { href: '/ai-nurture', label: 'AI Nurture', icon: Sparkles },
  { href: '/inbox', label: 'Inbox', icon: Inbox, badge: true },
  { href: '/templates', label: 'Templates', icon: FileStack },
  { href: '/intelligence', label: 'Intelligence', icon: Brain },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [inboxBadge, setInboxBadge] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchBadge = async () => {
      try {
        const res = await fetch('/api/ai-conversations?filter=needs_action');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setInboxBadge(data.needs_action_count || 0);
      } catch { /* silent */ }
    };
    fetchBadge();
    const interval = setInterval(fetchBadge, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <>
      <button
        type="button"
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
        className="lg:hidden fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm"
        onClick={() => setMobileOpen((o) => !o)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 z-40 flex w-64 flex-col border-r border-border bg-sidebar transition-transform duration-200 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="px-6 py-5 border-b border-border">
          <Link href="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <span className="text-base font-bold text-foreground">Drip Engine</span>
              <span className="block text-[10px] text-muted tracking-wider uppercase">FUB Platform</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted hover:text-foreground hover:bg-card-hover'
                )}
              >
                <item.icon size={18} />
                <span className="flex-1">{item.label}</span>
                {'badge' in item && item.badge && inboxBadge > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                    {inboxBadge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-border">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-all hover:bg-card-hover hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              <LogOut size={18} />
              Logout
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
