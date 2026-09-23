'use client';

import { Alert, Badge, Button, Card, EmptyState, PageHeader } from '@app/ui';
import Link from 'next/link';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, useApi } from '@/lib/use-api';

export default function PatientHome() {
  const { user } = useAuth();
  const appts = useApi(() => api().appointments.list({ status: 'SCHEDULED', pageSize: 3 }));
  const threads = useApi(() => api().threads.list({ pageSize: 3 }));
  const notes = useApi(() => api().notifications.list({ unreadOnly: true, pageSize: 5 }));
  const consents = useApi(() => api().patients.myConsents());
  const aiConsent = consents.data?.find((c) => c.type === 'AI_PROCESSING')?.status;

  return (
    <>
      <PageHeader title={`Hello, ${user?.firstName}`} subtitle="Your upcoming care at a glance" />
      {consents.data && aiConsent !== 'GRANTED' ? (
        <div className="mb-lg"><Alert tone="info" title="AI assistance is off for your account">Your clinic can use AI to prepare visit summaries and message drafts faster — always reviewed by your care team. <Link className="underline" href="/patient/consents">Review your choices</Link>.</Alert></div>
      ) : null}
      <div className="grid gap-lg md:grid-cols-2">
        <Card title="Upcoming appointments" action={<Link href="/patient/appointments"><Button variant="ghost">All</Button></Link>}>
          {appts.data?.items.length ? (
            <ul className="divide-y divide-line">
              {appts.data.items.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-sm">
                  <div>
                    <p className="font-medium">{fmtDate(a.scheduledAt)}</p>
                    <p className="text-sm text-ink-muted">{a.clinician ? `Dr ${a.clinician.user.lastName}` : 'Clinician to be confirmed'} · {a.reason ?? 'General'}</p>
                  </div>
                  {a.intakeForm?.status === 'PENDING' ? <Link href={`/patient/appointments/${a.id}/intake`}><Button>Complete intake</Button></Link> : <Badge tone={a.intakeForm?.status}>Intake {a.intakeForm?.status?.toLowerCase()}</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No upcoming appointments" body="Book one from the Appointments tab." />
          )}
        </Card>
        <Card title="Recent messages" action={<Link href="/patient/messages"><Button variant="ghost">Inbox</Button></Link>}>
          {threads.data?.items.length ? (
            <ul className="divide-y divide-line">
              {threads.data.items.map((t) => (
                <li key={t.id} className="py-sm">
                  <Link href={`/patient/messages/${t.id}`} className="block">
                    <p className="font-medium">{t.subject ?? 'Conversation'}</p>
                    <p className="line-clamp-1 text-sm text-ink-muted">{t.messages?.[0]?.body}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No messages yet" />
          )}
        </Card>
        <Card title="Notifications" className="md:col-span-2">
          {notes.data?.items.length ? (
            <ul className="divide-y divide-line">
              {notes.data.items.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-md py-sm">
                  <div><p className="font-medium">{n.title}</p><p className="text-sm text-ink-muted">{n.body}</p></div>
                  <Button variant="ghost" onClick={() => api().notifications.markRead(n.id).then(() => notes.reload())}>Dismiss</Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">You&apos;re all caught up.</p>
          )}
        </Card>
      </div>
    </>
  );
}
