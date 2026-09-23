'use client';

import { Button } from '@app/ui';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { useAuth } from '@/lib/auth';

const NAV: Record<string, Array<{ href: string; label: string }>> = {
  PATIENT: [
    { href: '/patient', label: 'Home' },
    { href: '/patient/appointments', label: 'Appointments' },
    { href: '/patient/messages', label: 'Messages' },
    { href: '/patient/documents', label: 'Documents' },
    { href: '/patient/consents', label: 'Privacy & consent' },
  ],
  CLINICIAN: [
    { href: '/clinician', label: 'Today' },
    { href: '/clinician/schedule', label: 'Schedule' },
    { href: '/clinician/drafts', label: 'AI review queue' },
    { href: '/clinician/inbox', label: 'Inbox' },
    { href: '/clinician/escalations', label: 'Escalations' },
  ],
  NURSE: [
    { href: '/clinician', label: 'Today' },
    { href: '/clinician/schedule', label: 'Schedule' },
    { href: '/clinician/drafts', label: 'AI review queue' },
    { href: '/clinician/inbox', label: 'Inbox' },
    { href: '/clinician/escalations', label: 'Escalations' },
  ],
  FRONT_DESK: [
    { href: '/clinician', label: 'Today' },
    { href: '/clinician/schedule', label: 'Schedule' },
    { href: '/clinician/inbox', label: 'Inbox' },
  ],
  ADMIN: [
    { href: '/admin', label: 'Overview' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/ai', label: 'AI governance' },
    { href: '/admin/audit', label: 'Audit log' },
  ],
  COMPLIANCE: [
    { href: '/admin', label: 'Overview' },
    { href: '/admin/audit', label: 'Audit log' },
  ],
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const nav = user ? (NAV[user.role] ?? []) : [];
  return (
    <div className="min-h-screen bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:bg-surface focus:p-2">Skip to content</a>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-md px-md py-sm">
          <Link href={nav[0]?.href ?? '/'} className="text-lg font-semibold text-primary">Clinical AI Platform</Link>
          <nav aria-label="Primary" className="flex flex-wrap gap-1">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} aria-current={pathname === n.href ? 'page' : undefined} className={clsx('rounded-md px-3 py-2 text-sm font-medium', pathname === n.href || (n.href !== nav[0]?.href && pathname.startsWith(n.href)) ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-background')}>
                {n.label}
              </Link>
            ))}
          </nav>
          {user ? (
            <div className="flex items-center gap-md text-sm">
              <span className="text-ink-muted">{user.firstName} {user.lastName} · {user.role.toLowerCase().replace('_', ' ')}</span>
              <Button variant="secondary" onClick={() => void logout()}>Sign out</Button>
            </div>
          ) : null}
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-md py-lg">{children}</main>
      <footer className="mx-auto max-w-6xl px-md pb-lg text-xs text-ink-muted">AI assists documentation and communication; every AI output is a draft reviewed by your care team. Do not use messaging for emergencies.</footer>
    </div>
  );
}
