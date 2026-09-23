'use client';

import { Badge, Button, Card, PageHeader } from '@app/ui';

import { api } from '@/lib/api';
import { fmtDate, useApi } from '@/lib/use-api';

const CONSENTS = [
  { type: 'TREATMENT', title: 'Treatment', body: 'Allow the clinic to record and use your health information to provide care.' },
  { type: 'DATA_PROCESSING', title: 'Data processing', body: 'Allow your information to be stored and processed by this platform.' },
  { type: 'MESSAGING', title: 'Secure messaging', body: 'Use secure messaging to communicate with your care team.' },
  { type: 'AI_PROCESSING', title: 'AI assistance', body: 'Allow AI tools to help your care team prepare visit summaries, notes and message drafts. Every AI output is reviewed by a clinician before it is used, and identifying details are removed before any external processing.' },
  { type: 'RESEARCH', title: 'Research', body: 'Allow de-identified information to be used for quality improvement and research.' },
] as const;
const VERSION = '2026-09';

export default function ConsentsPage() {
  const consents = useApi(() => api().patients.myConsents());
  const latest = (type: string) => consents.data?.find((c) => c.type === type);
  const record = (type: (typeof CONSENTS)[number]['type'], status: 'GRANTED' | 'DECLINED' | 'REVOKED') => api().patients.recordConsent({ type, status, version: VERSION }).then(() => consents.reload());

  return (
    <>
      <PageHeader title="Privacy & consent" subtitle="You can change these choices at any time. Changes take effect immediately." />
      <div className="space-y-md">
        {CONSENTS.map((c) => {
          const cur = latest(c.type);
          const granted = cur?.status === 'GRANTED';
          return (
            <Card key={c.type} title={c.title} action={cur ? <Badge tone={granted ? 'APPROVED' : 'REJECTED'}>{cur.status.toLowerCase()}</Badge> : <Badge>not set</Badge>}>
              <p className="text-sm text-ink-muted">{c.body}</p>
              {cur ? <p className="mt-sm text-xs text-ink-muted">Last updated {fmtDate(cur.createdAt)} · version {cur.version}</p> : null}
              <div className="mt-md flex gap-sm">
                {!granted ? <Button onClick={() => record(c.type, 'GRANTED')}>Allow</Button> : <Button variant="secondary" onClick={() => record(c.type, 'REVOKED')}>Withdraw</Button>}
                {!cur ? <Button variant="ghost" onClick={() => record(c.type, 'DECLINED')}>Decline</Button> : null}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
