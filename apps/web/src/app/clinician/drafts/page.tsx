'use client';

import { AiDisclosure, Badge, Card, EmptyState, PageHeader } from '@app/ui';
import Link from 'next/link';

import { api } from '@/lib/api';
import { fmtDate, useApi } from '@/lib/use-api';

export default function DraftQueue() {
  const queue = useApi(() => api().drafts.queue({ pageSize: 50 }));
  return (
    <>
      <PageHeader title="AI review queue" subtitle="Drafts waiting for a human decision. Nothing here has reached a patient." />
      <Card>
        <AiDisclosure />
        {queue.data?.items.length ? (
          <ul className="mt-md divide-y divide-line">
            {queue.data.items.map((d) => (
              <li key={d.id} className="py-sm">
                <Link href={`/clinician/drafts/${d.id}`} className="flex flex-wrap items-center justify-between gap-sm">
                  <div>
                    <p className="font-medium">{d.workflow.replace(/_/g, ' ').toLowerCase()} {d.safetyFlags?.length ? <Badge tone="HIGH">{d.safetyFlags.length} safety flag{d.safetyFlags.length > 1 ? 's' : ''}</Badge> : null}</p>
                    <p className="text-xs text-ink-muted">Requested by {d.requestedBy.firstName} {d.requestedBy.lastName} · {fmtDate(d.createdAt)} · {d.model ?? ''} {typeof d.confidence === 'number' ? `· confidence ${(d.confidence * 100).toFixed(0)}%` : ''}</p>
                  </div>
                  <Badge tone={d.status}>{d.status.replace('_', ' ').toLowerCase()}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-md"><EmptyState title="Queue is empty" /></div>
        )}
      </Card>
    </>
  );
}
