'use client';

import { Alert, Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Textarea } from '@app/ui';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';

import { api } from '@/lib/api';
import { errorMessage, fmtDate, useApi } from '@/lib/use-api';

export default function PatientAppointments() {
  const list = useApi(() => api().appointments.list({ pageSize: 50 }));
  const clinicians = useApi(() => api().clinicians.list());
  const [form, setForm] = useState({ clinicianId: '', scheduledAt: '', reason: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const book = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api().appointments.create({ clinicianId: form.clinicianId || undefined, scheduledAt: new Date(form.scheduledAt), durationMinutes: 20, reason: form.reason || undefined });
      setForm({ clinicianId: '', scheduledAt: '', reason: '' });
      await list.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Appointments" />
      <div className="grid gap-lg md:grid-cols-3">
        <div className="md:col-span-2">
          <Card title="Your appointments">
            {list.data?.items.length ? (
              <ul className="divide-y divide-line">
                {list.data.items.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-sm py-sm">
                    <div>
                      <p className="font-medium">{fmtDate(a.scheduledAt)} <Badge tone={a.status}>{a.status.replace('_', ' ')}</Badge></p>
                      <p className="text-sm text-ink-muted">{a.clinician ? `Dr ${a.clinician.user.lastName}` : 'Clinician to be confirmed'} · {a.reason ?? 'General'}</p>
                    </div>
                    <div className="flex gap-sm">
                      {a.status === 'SCHEDULED' && a.intakeForm?.status === 'PENDING' ? <Link href={`/patient/appointments/${a.id}/intake`}><Button>Intake form</Button></Link> : null}
                      {a.status === 'SCHEDULED' ? <Button variant="secondary" onClick={() => api().appointments.cancel(a.id, 'Cancelled by patient').then(() => list.reload())}>Cancel</Button> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No appointments" />
            )}
          </Card>
        </div>
        <Card title="Book an appointment">
          <form onSubmit={book} className="space-y-md">
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Field label="Clinician">
              <Select value={form.clinicianId} onChange={(e) => setForm({ ...form, clinicianId: e.target.value })}>
                <option value="">Any available</option>
                {clinicians.data?.map((c) => <option key={c.id} value={c.id}>Dr {c.user.firstName} {c.user.lastName}{c.specialty ? ` · ${c.specialty}` : ''}</option>)}
              </Select>
            </Field>
            <Field label="Date and time"><Input type="datetime-local" required value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></Field>
            <Field label="Reason for visit"><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={500} /></Field>
            <Button type="submit" loading={busy} className="w-full">Book</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
