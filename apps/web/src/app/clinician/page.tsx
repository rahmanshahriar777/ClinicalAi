'use client';

import { Badge, Button, Card, EmptyState, PageHeader } from '@app/ui';
import Link from 'next/link';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, useApi } from '@/lib/use-api';

export default function ClinicianHome() {
  const { user } = useAuth();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const appts = useApi(() => api().appointments.list({ from: start, to: end, pageSize: 50 }));
  const queue = useApi(() => (user?.role === 'FRONT_DESK' ? Promise.resolve({ items: [], total: 0, page: 1, pageSize: 5 }) : api().drafts.queue({ pageSize: 5 })), [user?.role]);
  const esc = useApi(() => api().escalations.list({ status: 'OPEN', pageSize: 5 }));
  const inbox = useApi(() => api().threads.list({ pageSize: 5 }));

  return (
    <>
      <PageHeader title={`Today, ${start.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}`} />
      {esc.data?.items.length ? (
        <Card className="mb-lg border-danger" title={`${esc.data.total} open escalation${esc.data.total === 1 ? '' : 's'}`} action={<Link href="/clinician/escalations"><Button variant="danger">Review now</Button></Link>}>
          <ul className="text-sm">{esc.data.items.map((e) => <li key={e.id} className="py-1"><Badge tone={e.urgency}>{e.urgency}</Badge> <span className="ml-2">{e.summary}</span></li>)}</ul>
        </Card>
      ) : null}
      <div className="grid gap-lg md:grid-cols-2">
        <Card title="Schedule" action={<Link href="/clinician/schedule"><Button variant="ghost">Full schedule</Button></Link>}>
          {appts.data?.items.length ? (
            <ul className="divide-y divide-line">
              {appts.data.items.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-sm">
                  <div>
                    <p className="font-medium">{new Date(a.scheduledAt).toLocaleTimeString(undefined, { timeStyle: 'short' })} · {a.patient.user.firstName} {a.patient.user.lastName}</p>
                    <p className="text-sm text-ink-muted">{a.reason ?? 'General'} · intake {a.intakeForm?.status?.toLowerCase()} {a.intakeForm?.urgency && a.intakeForm.urgency !== 'LOW' ? <Badge tone={a.intakeForm.urgency}>{a.intakeForm.urgency}</Badge> : null}</p>
                  </div>
                  <Badge tone={a.status}>{a.status.replace('_', ' ')}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing scheduled today" />
          )}
        </Card>
        <Card title="AI drafts awaiting review" action={<Link href="/clinician/drafts"><Button variant="ghost">Queue</Button></Link>}>
          {queue.data?.items.length ? (
            <ul className="divide-y divide-line">
              {queue.data.items.map((d) => (
                <li key={d.id} className="py-sm">
                  <Link href={`/clinician/drafts/${d.id}`} className="flex items-center justify-between">
                    <span className="font-medium">{d.workflow.replace(/_/g, ' ').toLowerCase()}</span>
                    <span className="text-xs text-ink-muted">{fmtDate(d.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Queue is empty.</p>
          )}
        </Card>
        <Card title="Inbox" className="md:col-span-2" action={<Link href="/clinician/inbox"><Button variant="ghost">Open inbox</Button></Link>}>
          {inbox.data?.items.length ? (
            <ul className="divide-y divide-line">
              {inbox.data.items.map((t) => (
                <li key={t.id} className="py-sm">
                  <Link href={`/clinician/inbox/${t.id}`} className="flex items-center justify-between gap-md">
                    <span><Badge tone={t.urgency}>{t.urgency}</Badge> <span className="ml-2 font-medium">{t.patient.user.firstName} {t.patient.user.lastName}</span> <span className="text-sm text-ink-muted">· {t.subject ?? 'Conversation'}</span></span>
                    <Badge tone={t.status}>{t.status.replace('_', ' ').toLowerCase()}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">No open conversations.</p>
          )}
        </Card>
      </div>
    </>
  );
}
