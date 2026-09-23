'use client';

import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';
import { RequireRole } from '@/lib/auth';

export default function ClinicianLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole roles={['CLINICIAN', 'NURSE', 'FRONT_DESK']}>
      <AppShell>{children}</AppShell>
    </RequireRole>
  );
}
