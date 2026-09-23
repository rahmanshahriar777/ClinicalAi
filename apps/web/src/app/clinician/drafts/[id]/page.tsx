'use client';

import { AiDisclosure, Alert, Badge, Button, Card, Field, PageHeader, Textarea } from '@app/ui';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { errorMessage, fmtDate, useApi } from '@/lib/use-api';

/** Generic editor for any workflow output: strings become textareas, arrays become comma lists, nested objects recurse. */
function OutputEditor({ value, onChange, path = '' }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void; path?: string }) {
  return (
    <div className="space-y-md">
      {Object.entries(value).map(([k, v]) => {
        const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
        if (typeof v === 'string') return <Field key={path + k} label={label}><Textarea rows={v.length > 120 ? 5 : 2} value={v} onChange={(e) => onChange({ ...value, [k]: e.target.value })} /></Field>;
        if (Array.isArray(v)) return <Field key={path + k} label={label} hint="Comma separated"><Textarea rows={2} value={v.join(', ')} onChange={(e) => onChange({ ...value, [k]: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></Field>;
        if (typeof v === 'boolean') return <label key={path + k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v} onChange={(e) => onChange({ ...value, [k]: e.target.checked })} />{label}</label>;
        if (typeof v === 'number') return <Field key={path + k} label={label}><input className="rounded-md border border-line p-2 text-sm" type="number" step="0.01" value={v} onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) })} /></Field>;
        if (v && typeof v === 'object') return <fieldset key={path + k} className="rounded-md border border-line p-md"><legend className="px-1 text-sm font-semibold">{label}</legend><OutputEditor value={v as Record<string, unknown>} onChange={(nv) => onChange({ ...value, [k]: nv })} path={`${path}${k}.`} /></fieldset>;
        return null;
      })}
    </div>
  );
}

export default function DraftReview() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const draft = useApi(() => api().drafts.get(id), [id]);
  const [edited, setEdited] = useState<Record<string, unknown> | null>(null);
  const [comments, setComments] = useState('');
  const [sendOnApprove, setSendOnApprove] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (draft.data?.output) setEdited(structuredClone(draft.data.output as Record<string, unknown>));
  }, [draft.data]);

  const decide = async (kind: 'approve' | 'reject') => {
    setBusy(kind);
    setError(null);
    try {
      const changed = JSON.stringify(edited) !== JSON.stringify(draft.data?.output);
      if (kind === 'approve') await api().drafts.approve(id, { editedOutput: changed ? edited ?? undefined : undefined, comments: comments || undefined, sendOnApprove });
      else await api().drafts.reject(id, comments || 'Rejected by reviewer');
      router.push('/clinician/drafts');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (!draft.data) return <p className="text-sm text-ink-muted">{draft.error ?? 'Loading…'}</p>;
  const d = draft.data;
  const pending = d.status === 'PENDING_REVIEW';
  const target = d.encounterId ? `/clinician/encounters/${d.encounterId}` : d.threadId ? `/clinician/inbox/${d.threadId}` : null;
  const aiFlaggedEscalation = (d.output as { escalationRecommended?: boolean } | null)?.escalationRecommended;

  return (
    <>
      <PageHeader title={`Review: ${d.workflow.replace(/_/g, ' ').toLowerCase()}`} subtitle={`Generated ${fmtDate(d.createdAt)} · ${d.provider}/${d.model} · prompt ${d.promptName}@v${d.promptVersion}`} action={<Badge tone={d.status}>{d.status.replace('_', ' ').toLowerCase()}</Badge>} />
      <div className="mb-md space-y-sm">
        <AiDisclosure />
        {d.safetyFlags?.length ? <Alert tone="warning" title="Safety flags raised by the pipeline">{d.safetyFlags.join(' · ')}</Alert> : null}
        {aiFlaggedEscalation ? <Alert tone="danger" title="The AI recommended escalation">Approving requires a comment explaining your clinical judgement. Consider the escalation queue.</Alert> : null}
        {d.status === 'FAILED' ? <Alert tone="danger" title="Generation failed">{d.failureReason}</Alert> : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
      <div className="grid gap-lg lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title={pending ? 'Edit before approving' : 'Output'}>
            {edited ? pending ? <OutputEditor value={edited} onChange={setEdited} /> : <pre className="whitespace-pre-wrap rounded-md bg-background p-md text-xs">{JSON.stringify(d.editedOutput ?? d.output, null, 2)}</pre> : <p className="text-sm text-ink-muted">No output.</p>}
          </Card>
        </div>
        <div className="space-y-lg">
          <Card title="Decision">
            {pending ? (
              <div className="space-y-md">
                <Field label="Comments" hint="Recorded in the audit trail"><Textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} /></Field>
                {d.workflow === 'PATIENT_MESSAGE_DRAFT' ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sendOnApprove} onChange={(e) => setSendOnApprove(e.target.checked)} />Send the reply to the patient on approval</label> : null}
                <div className="flex gap-sm"><Button loading={busy === 'approve'} onClick={() => decide('approve')}>Approve</Button><Button variant="danger" loading={busy === 'reject'} onClick={() => decide('reject')}>Reject</Button></div>
              </div>
            ) : (
              <ul className="space-y-sm text-sm">{d.approvals.map((a: { id: string; decision: string; comments?: string; reviewer: { firstName: string; lastName: string; role: string }; createdAt: string; editDistance?: number }) => <li key={a.id}><Badge tone={a.decision}>{a.decision.replace(/_/g, ' ').toLowerCase()}</Badge> by {a.reviewer.firstName} {a.reviewer.lastName} ({a.reviewer.role.toLowerCase()}) · {fmtDate(a.createdAt)}{typeof a.editDistance === 'number' ? ` · edit distance ${(a.editDistance * 100).toFixed(0)}%` : ''}{a.comments ? <p className="text-ink-muted">{a.comments}</p> : null}</li>)}</ul>
            )}
          </Card>
          <Card title="Provenance">
            <dl className="space-y-1 text-xs text-ink-muted">
              <div className="flex justify-between"><dt>Input hash</dt><dd className="font-mono">{d.inputHash?.slice(0, 16)}…</dd></div>
              <div className="flex justify-between"><dt>PHI redacted</dt><dd>{d.redactionApplied ? `yes (${d.invocation?.redactedEntityCount ?? 0} entities)` : 'no'}</dd></div>
              <div className="flex justify-between"><dt>Latency</dt><dd>{d.invocation?.latencyMs ?? '—'} ms</dd></div>
              <div className="flex justify-between"><dt>Injection signals</dt><dd>{d.invocation?.injectionSignals?.length ? d.invocation.injectionSignals.join(', ') : 'none'}</dd></div>
            </dl>
            {target ? <Link href={target} className="mt-md block text-sm text-primary underline">Open source record</Link> : null}
          </Card>
        </div>
      </div>
    </>
  );
}
