'use client';

import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';
import { RequireRole } from '@/lib/auth';

export default function PatientLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole roles={['PATIENT']}>
      <AppShell>{children}</AppShell>
    </RequireRole>
  );
}
