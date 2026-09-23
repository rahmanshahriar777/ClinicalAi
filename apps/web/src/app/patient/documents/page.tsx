'use client';

import { Badge, Card, EmptyState, PageHeader } from '@app/ui';
import { useState } from 'react';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, useApi } from '@/lib/use-api';

function DocBody({ content }: { content: Record<string, string> }) {
  if ('text' in content) return <p className="whitespace-pre-wrap text-sm">{content.text}</p>;
  return (
    <dl className="space-y-sm text-sm">
      {(['subjective', 'objective', 'assessment', 'plan'] as const).map((k) => (
        <div key={k}><dt className="font-semibold capitalize">{k}</dt><dd className="whitespace-pre-wrap text-ink-muted">{content[k]}</dd></div>
      ))}
    </dl>
  );
}

export default function PatientDocuments() {
  const { user } = useAuth();
  const docs = useApi(() => (user?.patientId ? api().http.get<Record<string, never>[]>(`/patients/${user.patientId}/documents`) : Promise.resolve([])), [user?.patientId]);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <PageHeader title="Your documents" subtitle="Visit summaries and letters your care team has shared with you." />
      <Card>
        {docs.data?.length ? (
          <ul className="divide-y divide-line">
            {docs.data.map((d: Record<string, never>) => (
              <li key={d.id} className="py-sm">
                <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen(open === d.id ? null : d.id)}>
                  <span><span className="font-medium">{String(d.type).replace(/_/g, ' ')}</span> <span className="text-sm text-ink-muted">· {fmtDate(d.sharedWithPatientAt)}</span></span>
                  <Badge tone={d.status}>{d.status}</Badge>
                </button>
                {open === d.id ? <div className="mt-md rounded-md bg-background p-md"><DocBody content={d.content} /></div> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No documents shared yet" body="After a visit, your clinician can share an after-visit summary here." />
        )}
      </Card>
    </>
  );
}
