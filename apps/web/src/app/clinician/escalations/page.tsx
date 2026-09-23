'use client';

import { Alert, Badge, Button, Card, EmptyState, PageHeader, Textarea } from '@app/ui';
import Link from 'next/link';
import { useState } from 'react';

import { api } from '@/lib/api';
import { errorMessage, fmtDate, useApi } from '@/lib/use-api';

export default function EscalationsPage() {
  const list = useApi(() => api().escalations.list({ pageSize: 100 }));
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const act = (fn: () => Promise<unknown>) => fn().then(() => list.reload()).catch((e) => setError(errorMessage(e)));

  return (
    <>
      <PageHeader title="Escalation queue" subtitle="Red flags from intake forms, patient messages and AI output. Acknowledge, contact the patient through your clinical process, then resolve with notes." />
      {error ? <div className="mb-md"><Alert tone="danger">{error}</Alert></div> : null}
      <Card>
        {list.data?.items.length ? (
          <ul className="divide-y divide-line">
            {list.data.items.map((e) => (
              <li key={e.id} className="space-y-sm py-md">
                <div className="flex flex-wrap items-center justify-between gap-sm">
                  <div>
                    <p className="font-medium"><Badge tone={e.urgency}>{e.urgency}</Badge> <span className="ml-2">{e.patient.user.firstName} {e.patient.user.lastName}</span> <span className="text-sm text-ink-muted">· via {e.source.toLowerCase().replace('_', ' ')} · {fmtDate(e.createdAt)}</span></p>
                    <p className="text-sm">{e.summary}</p>
                    <p className="text-xs text-ink-muted">Flags: {e.redFlags.join(', ') || '—'}{e.threadId ? <> · <Link className="text-primary underline" href={`/clinician/inbox/${e.threadId}`}>open thread</Link></> : null}</p>
                  </div>
                  <Badge tone={e.status}>{e.status.toLowerCase()}</Badge>
                </div>
                {e.status === 'OPEN' ? <Button variant="danger" onClick={() => act(() => api().escalations.acknowledge(e.id))}>Acknowledge</Button> : null}
                {e.status === 'ACKNOWLEDGED' ? (
                  <div className="flex flex-wrap items-end gap-sm">
                    <Textarea className="min-h-[60px] flex-1" placeholder="Resolution notes (required)" value={notes[e.id] ?? ''} onChange={(ev) => setNotes({ ...notes, [e.id]: ev.target.value })} />
                    <Button disabled={!notes[e.id]} onClick={() => act(() => api().escalations.resolve(e.id, notes[e.id]!))}>Resolve</Button>
                    <Button variant="secondary" disabled={!notes[e.id]} onClick={() => act(() => api().escalations.resolve(e.id, notes[e.id]!, true))}>Dismiss</Button>
                  </div>
                ) : null}
                {e.resolutionNotes ? <p className="text-sm text-ink-muted">Resolution: {e.resolutionNotes}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No escalations" body="Red-flag detections will appear here." />
        )}
      </Card>
    </>
  );
}
