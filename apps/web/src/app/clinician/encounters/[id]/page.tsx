'use client';

import { AiDisclosure, Alert, Badge, Button, Card, EmptyState, Field, Input, PageHeader, Textarea } from '@app/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { errorMessage, fmtDate, useApi } from '@/lib/use-api';
import { MicDictationButton, AudioReaderButton } from '@/components/voice';

type Soap = { subjective: string; objective: string; assessment: string; plan: string };
const EMPTY: Soap = { subjective: '', objective: '', assessment: '', plan: '' };

export default function EncounterPage() {
  const { id } = useParams<{ id: string }>();
  const enc = useApi(() => api().encounters.get(id), [id]);
  const docs = useApi(() => api().encounters.documents(id), [id]);
  const [notes, setNotes] = useState('');
  const [complaint, setComplaint] = useState('');
  const [editing, setEditing] = useState<{ id: string; content: Soap | { text: string }; status: string } | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (enc.data) {
      setNotes(enc.data.notes ?? '');
      setComplaint(enc.data.chiefComplaint ?? '');
    }
  }, [enc.data]);

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg({ tone: 'success', text: ok });
      await Promise.all([enc.reload(), docs.reload()]);
    } catch (e) {
      setMsg({ tone: 'danger', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  if (!enc.data) return <p className="text-sm text-ink-muted">{enc.error ?? 'Loading…'}</p>;
  const e = enc.data;
  const patient = e.appointment.patient;
  const intake = e.appointment.intakeForm;
  const started = Boolean(e.startedAt);
  const done = Boolean(e.endedAt);
  const latestDraft = e.aiDrafts?.find((d: { workflow: string; status: string }) => d.workflow === 'CLINICAL_NOTE' && ['QUEUED', 'GENERATING', 'PENDING_REVIEW', 'APPROVED'].includes(d.status));

  return (
    <>
      <PageHeader
        title={`${patient.user.firstName} ${patient.user.lastName}`}
        subtitle={`Appointment ${fmtDate(e.appointment.scheduledAt)} · ${e.appointment.reason ?? 'General'}`}
        action={
          <div className="flex gap-sm">
            {!started ? <Button loading={busy === 'start'} onClick={() => run('start', () => api().encounters.start(id, complaint || undefined))}>Start encounter</Button> : null}
            {started && !done ? <Button loading={busy === 'complete'} variant="secondary" onClick={() => run('complete', () => api().encounters.complete(id, true), 'Encounter completed')}>Complete visit</Button> : null}
            {done ? <Badge tone="APPROVED">Completed {fmtDate(e.endedAt)}</Badge> : null}
          </div>
        }
      />
      {msg ? <div className="mb-md"><Alert tone={msg.tone}>{msg.text}</Alert></div> : null}
      {intake?.urgency && intake.urgency !== 'LOW' ? <div className="mb-md"><Alert tone={intake.urgency === 'EMERGENCY' ? 'danger' : 'warning'} title={`Intake flagged ${intake.urgency}`}>Red flags: {intake.redFlags.join(', ')}</Alert></div> : null}

      <div className="grid gap-lg lg:grid-cols-3">
        <div className="space-y-lg lg:col-span-2">
          <Card title="Clinician notes" action={<Button variant="secondary" loading={busy === 'save'} disabled={done} onClick={() => run('save', () => api().encounters.update(id, { notes, chiefComplaint: complaint || undefined }), 'Saved')}>Save</Button>}>
            <div className="space-y-md">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-ink">Chief complaint</span>
                  {!done && (
                    <MicDictationButton
                      size="sm"
                      label="Dictate complaint"
                      clinicalContext="CHIEF_COMPLAINT"
                      onTranscript={(t) => setComplaint((prev) => (prev ? prev.trim() + ' ' : '') + t)}
                    />
                  )}
                </div>
                <Input value={complaint} onChange={(ev) => setComplaint(ev.target.value)} disabled={done} maxLength={500} placeholder="Patient's primary presenting concern…" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="text-sm font-medium text-ink">Shorthand notes</span>
                    <span className="block text-xs text-ink-muted">Trusted input to the AI note drafter. Speak or type factually.</span>
                  </div>
                  {!done && (
                    <div className="flex items-center gap-2">
                      {notes && <AudioReaderButton text={notes} label="Listen" size="sm" />}
                      <MicDictationButton
                        size="sm"
                        label="Dictate notes"
                        clinicalContext="SOAP_NOTE"
                        onTranscript={(t) => setNotes((prev) => (prev ? prev.trim() + ' ' : '') + t)}
                      />
                    </div>
                  )}
                </div>
                <Textarea value={notes} onChange={(ev) => setNotes(ev.target.value)} disabled={done} rows={8} placeholder="Dictate or type clinical exam, vital observations, history, and assessment thoughts…" />
              </div>
            </div>
          </Card>

          <Card title="AI note draft" action={<Button loading={busy === 'draft'} disabled={done} onClick={() => run('draft', async () => { await api().encounters.update(id, { notes }); await api().encounters.requestDraft(id, { workflow: 'CLINICAL_NOTE' }); }, 'Draft requested — it will appear in your review queue in a few seconds')}>Generate SOAP draft</Button>}>
            <AiDisclosure />
            {latestDraft ? (
              <p className="mt-md text-sm">Latest draft: <Badge tone={latestDraft.status}>{latestDraft.status.replace('_', ' ').toLowerCase()}</Badge> {latestDraft.status === 'PENDING_REVIEW' ? <Link className="ml-2 text-primary underline" href={`/clinician/drafts/${latestDraft.id}`}>Review it</Link> : null}</p>
            ) : (
              <p className="mt-md text-sm text-ink-muted">No draft yet. Requires the patient&apos;s AI consent and enough context (notes or intake).</p>
            )}
          </Card>

          <Card title="Documents" action={<Button variant="secondary" disabled={done} onClick={() => setEditing({ id: '', content: EMPTY, status: 'NEW' })}>New note</Button>}>
            {docs.data?.length ? (
              <ul className="divide-y divide-line">
                {docs.data.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-sm py-sm">
                    <div><p className="font-medium">{d.type.replace(/_/g, ' ')} <Badge tone={d.status}>{d.status.replace('_', ' ')}</Badge></p><p className="text-xs text-ink-muted">Updated {fmtDate(d.updatedAt)}{d.sharedWithPatientAt ? ' · shared with patient' : ''}</p></div>
                    <div className="flex flex-wrap gap-sm">
                      {!['SIGNED', 'AMENDED'].includes(d.status) ? <Button variant="ghost" onClick={() => api().documents.get(d.id).then((full) => setEditing({ id: full.id, content: full.content, status: full.status }))}>Edit</Button> : null}
                      {['DRAFT', 'AI_DRAFT', 'UNDER_REVIEW', 'REVISED'].includes(d.status) ? <Button variant="secondary" loading={busy === `approve-${d.id}`} onClick={() => run(`approve-${d.id}`, () => api().documents.approve(d.id))}>Approve</Button> : null}
                      {d.status === 'APPROVED' ? <Button loading={busy === `sign-${d.id}`} onClick={() => run(`sign-${d.id}`, () => api().documents.sign(d.id), 'Signed and hashed')}>Sign</Button> : null}
                      {['APPROVED', 'SIGNED', 'AMENDED'].includes(d.status) && !d.sharedWithPatientAt && d.type === 'AFTER_VISIT_SUMMARY' ? <Button variant="ghost" onClick={() => run(`share-${d.id}`, () => api().documents.share(d.id), 'Shared with patient')}>Share with patient</Button> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No documents yet" body="Approve an AI draft or start a note manually." />
            )}
            {editing ? <DocumentEditor state={editing} encounterId={id} onDone={() => { setEditing(null); void docs.reload(); }} /> : null}
          </Card>
        </div>

        <div className="space-y-lg">
          <Card title="Patient">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-ink-muted">Age</dt><dd>{Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / 31_557_600_000)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-muted">Language</dt><dd>{patient.preferredLang}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-muted">Started</dt><dd>{fmtDate(e.startedAt)}</dd></div>
            </dl>
          </Card>
          <Card title="Intake">
            {intake?.answers ? (
              <dl className="space-y-sm text-sm">
                {Object.entries(intake.answers as Record<string, unknown>).map(([k, v]) => (
                  <div key={k}><dt className="font-medium capitalize">{k.replace(/([A-Z])/g, ' $1')}</dt><dd className="whitespace-pre-wrap text-ink-muted">{Array.isArray(v) ? v.join(', ') : String(v)}</dd></div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-ink-muted">Not submitted.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function DocumentEditor({ state, encounterId, onDone }: { state: { id: string; content: Soap | { text: string }; status: string }; encounterId: string; onDone: () => void }) {
  const isSoap = !('text' in state.content);
  const [soap, setSoap] = useState<Soap>(isSoap ? (state.content as Soap) : EMPTY);
  const [text, setText] = useState(!isSoap ? (state.content as { text: string }).text : '');
  const [type, setType] = useState<'SOAP_NOTE' | 'AFTER_VISIT_SUMMARY' | 'PROGRESS_NOTE'>('SOAP_NOTE');
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setError(null);
    try {
      const content = type === 'AFTER_VISIT_SUMMARY' && !state.id ? { text } : isSoap || !state.id ? soap : { text };
      if (state.id) await api().documents.update(state.id, content, 'Edited by clinician');
      else await api().encounters.createDocument(encounterId, { type, content });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  return (
    <div className="mt-md space-y-md rounded-md border border-line bg-background p-md">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!state.id ? (
        <Field label="Document type">
          <select className="rounded-md border border-line p-2 text-sm" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="SOAP_NOTE">SOAP note</option><option value="PROGRESS_NOTE">Progress note</option><option value="AFTER_VISIT_SUMMARY">After-visit summary (patient-facing)</option>
          </select>
        </Field>
      ) : null}
      {(state.id ? isSoap : type !== 'AFTER_VISIT_SUMMARY') ? (
        (['subjective', 'objective', 'assessment', 'plan'] as const).map((k) => (
          <div key={k} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink capitalize">{k}</span>
              <div className="flex items-center gap-1.5">
                {soap[k] && <AudioReaderButton text={soap[k]} size="sm" />}
                <MicDictationButton
                  size="sm"
                  label={`Dictate ${k}`}
                  clinicalContext="SOAP_NOTE"
                  onTranscript={(t) => setSoap((prev) => ({ ...prev, [k]: (prev[k] ? prev[k].trim() + ' ' : '') + t }))}
                />
              </div>
            </div>
            <Textarea rows={3} value={soap[k]} onChange={(e) => setSoap({ ...soap, [k]: e.target.value })} />
          </div>
        ))
      ) : (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">Plain-language summary for the patient</span>
            <div className="flex items-center gap-1.5">
              {text && <AudioReaderButton text={text} size="sm" label="Read summary" />}
              <MicDictationButton
                size="sm"
                label="Dictate summary"
                clinicalContext="PATIENT_COMMUNICATION"
                onTranscript={(t) => setText((prev) => (prev ? prev.trim() + ' ' : '') + t)}
              />
            </div>
          </div>
          <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      )}
      <div className="flex gap-sm"><Button onClick={save}>Save</Button><Button variant="secondary" onClick={onDone}>Cancel</Button></div>
    </div>
  );
}
