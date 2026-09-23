'use client';

import { Alert, Button, Card, Field, Input, PageHeader, Textarea } from '@app/ui';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { api } from '@/lib/api';
import { errorMessage, useApi } from '@/lib/use-api';

export default function IntakePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const form = useApi(() => api().appointments.intake(id), [id]);
  const [a, setA] = useState({ chiefComplaint: '', symptomDuration: '', symptoms: '', medications: '', allergies: '', medicalHistory: '', painScale: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof a) => (e: { target: { value: string } }) => setA((s) => ({ ...s, [k]: e.target.value }));
  const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api().appointments.submitIntake(id, { answers: { chiefComplaint: a.chiefComplaint || undefined, symptomDuration: a.symptomDuration || undefined, symptoms: list(a.symptoms), medications: list(a.medications), allergies: list(a.allergies), medicalHistory: a.medicalHistory || undefined, painScale: a.painScale ? Number(a.painScale) : undefined } });
      router.push('/patient/appointments');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (form.data && form.data.status !== 'PENDING') return <Alert tone="success" title="Intake already submitted">Thank you — your care team will review it before your visit.</Alert>;

  return (
    <>
      <PageHeader title="Pre-visit intake" subtitle="Takes about 3 minutes. Your answers are reviewed by your care team before your appointment." />
      <Alert tone="warning" title="Not for emergencies">If you have chest pain, difficulty breathing, signs of stroke, severe bleeding or thoughts of harming yourself, call your local emergency number now.</Alert>
      <Card className="mt-lg">
        <form onSubmit={submit} className="space-y-md">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label="What brings you in?"><Textarea required value={a.chiefComplaint} onChange={set('chiefComplaint')} maxLength={2000} /></Field>
          <div className="grid gap-md md:grid-cols-2">
            <Field label="How long has this been going on?"><Input value={a.symptomDuration} onChange={set('symptomDuration')} placeholder="e.g. 3 days" /></Field>
            <Field label="Pain level (0–10)"><Input type="number" min={0} max={10} value={a.painScale} onChange={set('painScale')} /></Field>
          </div>
          <Field label="Symptoms" hint="Separate with commas"><Input value={a.symptoms} onChange={set('symptoms')} /></Field>
          <Field label="Current medications" hint="Separate with commas"><Input value={a.medications} onChange={set('medications')} /></Field>
          <Field label="Allergies" hint="Separate with commas"><Input value={a.allergies} onChange={set('allergies')} /></Field>
          <Field label="Relevant medical history"><Textarea value={a.medicalHistory} onChange={set('medicalHistory')} maxLength={5000} /></Field>
          <Button type="submit" loading={busy}>Submit intake</Button>
        </form>
      </Card>
    </>
  );
}
