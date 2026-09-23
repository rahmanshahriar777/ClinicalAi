'use client';

import { Badge, Button, Card, EmptyState, Field, Input, PageHeader } from '@app/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, useApi } from '@/lib/use-api';

export default function SchedulePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
  const list = useApi(() => api().appointments.list({ from: new Date(from), to: new Date(`${to}T23:59:59`), pageSize: 100 }), [from, to]);
  const isClinician = user?.role === 'CLINICIAN';

  const open = async (a: { id?: string; encounter?: { id: string } | null }) => {
    if (a.encounter?.id) return router.push(`/clinician/encounters/${a.encounter.id}`);
    const enc = await api().appointments.openEncounter(a.id!);
    router.push(`/clinician/encounters/${enc.id}`);
  };

  return (
    <>
      <PageHeader title="Schedule" action={<div className="flex gap-sm"><Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></div>} />
      <Card>
        {list.data?.items.length ? (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-ink-muted"><tr><th className="py-2">When</th><th>Patient</th><th>Reason</th><th>Intake</th><th>Status</th><th /></tr></thead>
            <tbody className="divide-y divide-line">
              {list.data.items.map((a) => (
                <tr key={a.id}>
                  <td className="py-sm">{fmtDate(a.scheduledAt)}</td>
                  <td>{a.patient.user.firstName} {a.patient.user.lastName}</td>
                  <td className="text-ink-muted">{a.reason ?? '—'}</td>
                  <td>{a.intakeForm ? <Badge tone={a.intakeForm.urgency !== 'LOW' ? a.intakeForm.urgency : a.intakeForm.status}>{a.intakeForm.status.toLowerCase()}{a.intakeForm.urgency !== 'LOW' ? ` · ${a.intakeForm.urgency}` : ''}</Badge> : '—'}</td>
                  <td><Badge tone={a.status}>{a.status.replace('_', ' ')}</Badge></td>
                  <td className="text-right">
                    {a.status === 'SCHEDULED' ? <Button variant="secondary" onClick={() => api().appointments.checkIn(a.id).then(() => list.reload())}>Check in</Button> : null}
                    {isClinician && ['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'SCHEDULED'].includes(a.status) ? <Button className="ml-sm" onClick={() => open(a)}>{a.encounter ? 'Open encounter' : 'Start encounter'}</Button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="No appointments in this range" />
        )}
      </Card>
    </>
  );
}
