'use client';

import { Alert, Button, Card, Field, Input } from '@app/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { api, tokenStore } from '@/lib/api';
import { errorMessage } from '@/lib/use-api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ organizationId: process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ?? '', email: '', password: '', firstName: '', lastName: '', dateOfBirth: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api().auth.register({ ...form, dateOfBirth: new Date(form.dateOfBirth), preferredLang: 'en', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      tokenStore.setTokens(r.tokens as never);
      window.location.assign('/patient/consents');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-md">
      <Card title="Create your patient account">
        <form onSubmit={submit} className="space-y-md">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label="Clinic ID" hint="Provided by your clinic"><Input required value={form.organizationId} onChange={set('organizationId')} /></Field>
          <div className="grid grid-cols-2 gap-md">
            <Field label="First name"><Input required value={form.firstName} onChange={set('firstName')} /></Field>
            <Field label="Last name"><Input required value={form.lastName} onChange={set('lastName')} /></Field>
          </div>
          <Field label="Date of birth"><Input type="date" required value={form.dateOfBirth} onChange={set('dateOfBirth')} /></Field>
          <Field label="Email"><Input type="email" required value={form.email} onChange={set('email')} /></Field>
          <Field label="Password" hint="At least 12 characters with upper, lower case and a digit"><Input type="password" required minLength={12} value={form.password} onChange={set('password')} /></Field>
          <Button type="submit" loading={busy} className="w-full">Create account</Button>
        </form>
        <p className="mt-md text-center text-sm text-ink-muted">Already registered? <Link href="/login" className="text-primary">Sign in</Link></p>
      </Card>
      <p className="mt-md text-center"><button className="text-xs text-ink-muted" onClick={() => router.push('/login')}>Back</button></p>
    </main>
  );
}
