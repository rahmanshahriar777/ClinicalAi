'use client';

import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select } from '@app/ui';
import { type FormEvent, useState } from 'react';

import { api } from '@/lib/api';
import { errorMessage, useApi } from '@/lib/use-api';

export default function UsersPage() {
  const users = useApi(() => api().admin.users({ pageSize: 100 }));
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', role: 'CLINICIAN', password: '', specialty: '' });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api().admin.createUser({ email: form.email, firstName: form.firstName, lastName: form.lastName, role: form.role as never, password: form.password || undefined, clinician: form.role === 'CLINICIAN' ? { specialty: form.specialty || undefined } : undefined });
      setForm({ email: '', firstName: '', lastName: '', role: 'CLINICIAN', password: '', specialty: '' });
      await users.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title="Users" />
      <div className="grid gap-lg md:grid-cols-3">
        <div className="md:col-span-2">
          <Card title="Organisation users">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-ink-muted"><tr><th className="py-2">Name</th><th>Email</th><th>Role</th><th>MFA</th><th>Status</th><th /></tr></thead>
              <tbody className="divide-y divide-line">
                {users.data?.items.map((u) => (
                  <tr key={u.id}><td className="py-2">{u.firstName} {u.lastName}</td><td className="text-ink-muted">{u.email}</td><td>{u.role}</td><td>{u.mfaEnabled ? 'on' : 'off'}</td><td><Badge tone={u.isActive ? 'APPROVED' : 'REJECTED'}>{u.isActive ? 'active' : 'inactive'}</Badge></td><td className="text-right"><Button variant="ghost" onClick={() => api().admin.updateUser(u.id, { isActive: !u.isActive }).then(() => users.reload()).catch((e) => setError(errorMessage(e)))}>{u.isActive ? 'Deactivate' : 'Reactivate'}</Button></td></tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
        <Card title="Add staff user">
          <form onSubmit={create} className="space-y-md">
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Field label="Role"><Select value={form.role} onChange={set('role')}>{['CLINICIAN', 'NURSE', 'FRONT_DESK', 'ADMIN', 'COMPLIANCE'].map((r) => <option key={r}>{r}</option>)}</Select></Field>
            <Field label="First name"><Input required value={form.firstName} onChange={set('firstName')} /></Field>
            <Field label="Last name"><Input required value={form.lastName} onChange={set('lastName')} /></Field>
            <Field label="Email"><Input type="email" required value={form.email} onChange={set('email')} /></Field>
            {form.role === 'CLINICIAN' ? <Field label="Specialty"><Input value={form.specialty} onChange={set('specialty')} /></Field> : null}
            <Field label="Temporary password" hint="Local auth mode only; leave blank in OIDC mode"><Input type="password" value={form.password} onChange={set('password')} /></Field>
            <Button type="submit" className="w-full">Create</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
