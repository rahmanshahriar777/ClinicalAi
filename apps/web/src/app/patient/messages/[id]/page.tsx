'use client';

import { Alert, Badge, Button, Card, PageHeader, Textarea } from '@app/ui';
import clsx from 'clsx';
import { useParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { errorMessage, fmtDate, useApi } from '@/lib/use-api';

export default function PatientThread() {
  const { id } = useParams<{ id: string }>();
  const thread = useApi(() => api().threads.get(id), [id]);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (thread.data) void api().threads.markRead(id);
  }, [thread.data, id]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api().threads.send(id, { body });
      setBody('');
      await thread.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!thread.data) return <p className="text-sm text-ink-muted">{thread.error ?? 'Loading…'}</p>;
  const t = thread.data;
  return (
    <>
      <PageHeader title={t.subject ?? 'Conversation'} subtitle={`Started ${fmtDate(t.createdAt)}`} action={<Badge tone={t.status}>{t.status.replace('_', ' ').toLowerCase()}</Badge>} />
      <Card>
        <ol className="space-y-md">
          {t.messages.map((m: { id: string; senderType: string; body: string; createdAt: string }) => (
            <li key={m.id} className={clsx('max-w-[85%] rounded-lg p-md text-sm', m.senderType === 'PATIENT' ? 'ml-auto bg-primary-soft' : m.senderType === 'SYSTEM' ? 'border-l-4 border-danger bg-danger-soft' : 'bg-background')}>
              <p className="mb-1 text-xs text-ink-muted">{m.senderType === 'PATIENT' ? 'You' : m.senderType === 'SYSTEM' ? 'Important' : 'Care team'} · {fmtDate(m.createdAt)}</p>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
        </ol>
        {t.status !== 'CLOSED' ? (
          <form onSubmit={send} className="mt-lg space-y-sm">
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Textarea required value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} placeholder="Write a reply…" />
            <Button type="submit">Send</Button>
          </form>
        ) : (
          <p className="mt-md text-sm text-ink-muted">This conversation is closed. Start a new message if you need anything else.</p>
        )}
      </Card>
    </>
  );
}
