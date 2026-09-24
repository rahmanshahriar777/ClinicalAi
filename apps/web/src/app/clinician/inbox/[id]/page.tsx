'use client';

import { AiDisclosure, Alert, Badge, Button, Card, PageHeader, Select, Textarea } from '@app/ui';
import clsx from 'clsx';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage, fmtDate, useApi } from '@/lib/use-api';
import { MicDictationButton, AudioReaderButton } from '@/components/voice';

export default function StaffThread() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const thread = useApi(() => api().threads.get(id), [id]);
  const drafts = useApi(() => api().drafts.queue({ pageSize: 50, workflow: 'PATIENT_MESSAGE_DRAFT' }).then((q) => q.items.filter((d) => d.threadId === id)), [id]);
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const canSend = user?.permissions?.includes('message:send');
  const canAi = user?.permissions?.includes('ai:invoke');

  useEffect(() => {
    if (thread.data) void api().threads.markRead(id);
  }, [thread.data, id]);

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg({ tone: 'success', text: ok });
      await Promise.all([thread.reload(), drafts.reload()]);
    } catch (e) {
      setMsg({ tone: 'danger', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    void run('send', () => api().threads.send(id, { body }).then(() => setBody('')));
  };

  if (!thread.data) return <p className="text-sm text-ink-muted">{thread.error ?? 'Loading…'}</p>;
  const t = thread.data;
  const pendingDraft = drafts.data?.[0];

  return (
    <>
      <PageHeader title={`${t.patient.user.firstName} ${t.patient.user.lastName} · ${t.subject ?? 'Conversation'}`} subtitle={`${t.intent ? `Intent: ${t.intent.replace('_', ' ')} · suggested route: ${t.suggestedRoute?.replace('_', ' ')} · ` : ''}started ${fmtDate(t.createdAt)}`} action={<div className="flex gap-sm"><Badge tone={t.urgency}>{t.urgency}</Badge><Badge tone={t.status}>{t.status.replace('_', ' ').toLowerCase()}</Badge></div>} />
      {msg ? <div className="mb-md"><Alert tone={msg.tone}>{msg.text}</Alert></div> : null}
      {t.status === 'ESCALATED' ? <div className="mb-md"><Alert tone="danger" title="This thread is escalated">Red flags were detected. Review it in the <Link href="/clinician/escalations" className="underline">escalation queue</Link>; the patient has received the emergency guidance message.</Alert></div> : null}
      <div className="grid gap-lg lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <ol className="space-y-md">
              {t.messages.map((m: { id: string; senderType: string; body: string; createdAt: string; aiDrafted: boolean; redFlags: string[] }) => (
                <li key={m.id} className={clsx('max-w-[85%] rounded-lg p-md text-sm', m.senderType === 'STAFF' ? 'ml-auto bg-primary-soft' : m.senderType === 'SYSTEM' ? 'border-l-4 border-danger bg-danger-soft' : 'bg-background')}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-ink-muted">{m.senderType === 'PATIENT' ? 'Patient' : m.senderType === 'SYSTEM' ? 'System' : 'Care team'} · {fmtDate(m.createdAt)}{m.aiDrafted ? ' · AI-drafted, human-approved' : ''}{m.redFlags?.length ? ` · flags: ${m.redFlags.join(', ')}` : ''}</p>
                    <AudioReaderButton text={m.body} size="sm" variant="ghost" label="Listen" />
                  </div>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </li>
              ))}
            </ol>
            {canSend && t.status !== 'CLOSED' ? (
              <form onSubmit={send} className="mt-lg space-y-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-ink">Reply message</span>
                  <MicDictationButton
                    size="sm"
                    label="Dictate reply"
                    clinicalContext="PATIENT_COMMUNICATION"
                    onTranscript={(text) => setBody((prev) => (prev ? prev.trim() + ' ' : '') + text)}
                  />
                </div>
                <Textarea required value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} placeholder="Reply to the patient or use voice dictation…" />
                <div className="flex flex-wrap gap-sm">
                  <Button type="submit" loading={busy === 'send'}>Send</Button>
                  {canAi ? <Button type="button" variant="secondary" loading={busy === 'draft'} onClick={() => run('draft', () => api().threads.requestDraft(id), 'AI draft requested — refresh in a few seconds')}>Draft reply with AI</Button> : null}
                </div>
              </form>
            ) : null}
          </Card>
        </div>
        <div className="space-y-lg">
          <Card title="AI draft">
            <AiDisclosure compact />
            {pendingDraft ? <p className="mt-sm text-sm">A draft is waiting: <Link href={`/clinician/drafts/${pendingDraft.id}`} className="text-primary underline">review and send</Link></p> : <p className="mt-sm text-sm text-ink-muted">No pending draft for this thread.</p>}
          </Card>
          <Card title="Routing">
            <div className="space-y-sm text-sm">
              <label className="block">Status<Select value={t.status} onChange={(e) => run('status', () => api().threads.update(id, { status: e.target.value }))}>{['OPEN', 'TRIAGING', 'ROUTED', 'AWAITING_REVIEW', 'ESCALATED', 'RESOLVED', 'CLOSED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}</Select></label>
              <label className="block">Urgency<Select value={t.urgency} onChange={(e) => run('urgency', () => api().threads.update(id, { urgency: e.target.value }))}>{['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'].map((s) => <option key={s} value={s}>{s}</option>)}</Select></label>
              <Button variant="secondary" className="w-full" loading={busy === 'assign'} onClick={() => run('assign', () => api().threads.update(id, { assignedToUserId: user!.id }))}>{t.assignedTo?.id === user?.id ? 'Assigned to you' : 'Assign to me'}</Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
