'use client';

import { Alert, Badge, Button, Card, EmptyState, Field, Input, PageHeader, Textarea } from '@app/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { api } from '@/lib/api';
import { errorMessage, fmtDate, useApi } from '@/lib/use-api';
import { MicDictationButton } from '@/components/voice';

export default function PatientMessages() {
  const router = useRouter();
  const threads = useApi(() => api().threads.list({ pageSize: 50 }));
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const t = await api().threads.create({ subject: subject || undefined, body });
      router.push(`/patient/messages/${t.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Messages" subtitle="Replies usually arrive within one working day." />
      <Alert tone="warning">Messaging is not monitored around the clock. For urgent symptoms, call your clinic or your local emergency number.</Alert>
      <div className="mt-lg grid gap-lg md:grid-cols-3">
        <div className="md:col-span-2">
          <Card title="Conversations">
            {threads.data?.items.length ? (
              <ul className="divide-y divide-line">
                {threads.data.items.map((t) => (
                  <li key={t.id} className="py-sm">
                    <Link href={`/patient/messages/${t.id}`} className="flex items-center justify-between gap-md">
                      <div><p className="font-medium">{t.subject ?? 'Conversation'}</p><p className="line-clamp-1 text-sm text-ink-muted">{t.messages?.[0]?.body}</p></div>
                      <div className="text-right text-xs text-ink-muted"><Badge tone={t.status}>{t.status.replace('_', ' ').toLowerCase()}</Badge><p>{fmtDate(t.lastMessageAt)}</p></div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No conversations yet" />
            )}
          </Card>
        </div>
        <Card title="New message">
          <form onSubmit={create} className="space-y-md">
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="Brief topic…" /></Field>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-ink">Message</span>
                <MicDictationButton
                  size="sm"
                  label="Speak message"
                  clinicalContext="PATIENT_COMMUNICATION"
                  onTranscript={(text) => setBody((prev) => (prev ? prev.trim() + ' ' : '') + text)}
                />
              </div>
              <Textarea required value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} placeholder="Type or speak your questions or symptoms here…" />
            </div>
            <Button type="submit" loading={busy} className="w-full">Send</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
