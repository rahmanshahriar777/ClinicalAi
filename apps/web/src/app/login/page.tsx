'use client';

import { Alert, Button, Card, Field, Input } from '@app/ui';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/use-api';

import { ClinicBridgeLogo } from '@/components/clinicbridge-logo';

export default function LoginPage() {
  const { login, verifyMfa } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mfaToken) await verifyMfa(mfaToken, code);
      else {
        const r = await login(email, password);
        if (r.mfaRequired && r.mfaToken) setMfaToken(r.mfaToken);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-md py-xl">
      <div className="mb-lg flex flex-col items-center text-center">
        <ClinicBridgeLogo variant="full" size="lg" href="/" priority className="mb-2" />
        <p className="mt-1 text-sm font-medium text-ink-muted">Clinical Documentation and Patient Communication Engine</p>
      </div>
      <Card title={mfaToken ? 'Enter your authentication code' : 'Sign in'}>
        <form onSubmit={submit} className="space-y-md">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {mfaToken ? (
            <Field label="6-digit code" hint="From your authenticator app">
              <Input inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" required value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
          ) : (
            <>
              <Field label="Email">
                <Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Password">
                <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
            </>
          )}
          <Button type="submit" loading={busy} className="w-full">{mfaToken ? 'Verify' : 'Sign in'}</Button>
        </form>
        <p className="mt-md text-center text-sm text-ink-muted">New patient? <Link href="/register" className="text-primary">Create an account</Link></p>
      </Card>
      <p className="mt-lg text-center text-xs text-ink-muted">If you are experiencing a medical emergency, call your local emergency number now.</p>
    </main>
  );
}
