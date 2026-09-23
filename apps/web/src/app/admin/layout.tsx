'use client';

import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';
import { RequireRole } from '@/lib/auth';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole roles={['ADMIN', 'COMPLIANCE']}>
      <AppShell>{children}</AppShell>
    </RequireRole>
  );
}
