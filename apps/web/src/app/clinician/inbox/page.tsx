'use client';

import { Badge, Card, EmptyState, PageHeader, Select } from '@app/ui';
import Link from 'next/link';
import { useState } from 'react';

import { api } from '@/lib/api';
import { fmtDate, useApi } from '@/lib/use-api';

export default function InboxPage() {
  const [status, setStatus] = useState('');
  const [mine, setMine] = useState(false);
  const threads = useApi(() => api().threads.list({ pageSize: 100, status: (status || undefined) as never, assignedToMe: mine || undefined }), [status, mine]);
  return (
    <>
      <PageHeader title="Inbox" subtitle="Sorted by urgency, then most recent." action={<div className="flex items-end gap-sm"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{['TRIAGING', 'ROUTED', 'AWAITING_REVIEW', 'ESCALATED', 'RESOLVED', 'CLOSED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}</Select><label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />Assigned to me</label></div>} />
      <Card>
        {threads.data?.items.length ? (
          <ul className="divide-y divide-line">
            {threads.data.items.map((t) => (
              <li key={t.id} className="py-sm">
                <Link href={`/clinician/inbox/${t.id}`} className="flex flex-wrap items-center justify-between gap-sm">
                  <div>
                    <p className="font-medium"><Badge tone={t.urgency}>{t.urgency}</Badge> <span className="ml-2">{t.patient.user.firstName} {t.patient.user.lastName}</span> <span className="text-ink-muted">· {t.subject ?? 'Conversation'}</span></p>
                    <p className="line-clamp-1 text-sm text-ink-muted">{t.messages?.[0]?.body}</p>
                    <p className="text-xs text-ink-muted">{t.intent ? `${t.intent.replace('_', ' ')} → ${t.suggestedRoute?.replace('_', ' ')} · ` : ''}{t.assignedTo ? `assigned to ${t.assignedTo.firstName} ${t.assignedTo.lastName}` : 'unassigned'} · {fmtDate(t.lastMessageAt)}</p>
                  </div>
                  <Badge tone={t.status}>{t.status.replace('_', ' ').toLowerCase()}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No conversations" />
        )}
      </Card>
    </>
  );
}
