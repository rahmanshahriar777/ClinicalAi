'use client';

import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Textarea } from '@app/ui';
import { type FormEvent, useState } from 'react';

import { api } from '@/lib/api';
import { errorMessage, useApi } from '@/lib/use-api';

const WORKFLOWS = ['CLINICAL_NOTE', 'PATIENT_MESSAGE_DRAFT', 'INTAKE_SUMMARY', 'PATIENT_EDUCATION', 'MESSAGE_TRIAGE'] as const;

export default function AiGovernancePage() {
  const cfg = useApi(() => api().admin.aiConfig());
  const flags = useApi(() => api().admin.flags());
  const prompts = useApi(() => api().admin.prompts());
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState({ name: '', workflow: 'PATIENT_MESSAGE_DRAFT', systemPrompt: '', userTemplate: '', description: '', activate: false });
  const save = (fn: () => Promise<unknown>, reload: () => Promise<void>) => fn().then(() => reload()).catch((e) => setError(errorMessage(e)));
  const effective = cfg.data?.effective;
  const env = cfg.data?.environment;

  const publish = (e: FormEvent) => {
    e.preventDefault();
    void save(() => api().admin.upsertPrompt({ ...prompt, workflow: prompt.workflow as never }), prompts.reload);
  };

  return (
    <>
      <PageHeader title="AI governance" subtitle="Organisation policy can only be stricter than the deployment environment." />
      {error ? <div className="mb-md"><Alert tone="danger">{error}</Alert></div> : null}
      <div className="grid gap-lg md:grid-cols-2">
        <Card title="Policy">
          {effective && env ? (
            <div className="space-y-sm text-sm">
              {([
                ['externalAiAllowed', 'External AI providers allowed', env.externalAiAllowed],
                ['phiRedactionEnabled', 'PHI redaction before AI calls', env.phiRedactionEnabled],
                ['requireClinicianApproval', 'Only clinicians approve AI drafts', env.requireClinicianApproval],
              ] as const).map(([key, label, envVal]) => (
                <div key={key} className="flex items-center justify-between gap-md">
                  <span>{label} <span className="text-xs text-ink-muted">(environment: {String(envVal)})</span></span>
                  <div className="flex items-center gap-sm"><Badge tone={effective[key] ? 'APPROVED' : 'REJECTED'}>{effective[key] ? 'on' : 'off'}</Badge><Button variant="ghost" onClick={() => save(() => api().admin.updateAiConfig({ [key]: !effective[key] }), cfg.reload)}>Toggle</Button></div>
                </div>
              ))}
              <p className="pt-sm font-semibold">Workflows</p>
              {WORKFLOWS.map((w) => (
                <div key={w} className="flex items-center justify-between"><span>{w.replace(/_/g, ' ').toLowerCase()}</span><div className="flex items-center gap-sm"><Badge tone={effective.workflows[w] ? 'APPROVED' : 'REJECTED'}>{effective.workflows[w] ? 'enabled' : 'disabled'}</Badge><Button variant="ghost" onClick={() => save(() => api().admin.updateAiConfig({ workflows: { ...effective.workflows, [w]: !effective.workflows[w] } }), cfg.reload)}>Toggle</Button></div></div>
              ))}
              <p className="pt-sm text-xs text-ink-muted">Provider: {effective.provider} · temperature {effective.temperature} · max tokens {effective.maxTokens}</p>
            </div>
          ) : null}
        </Card>
        <Card title="Feature flags">
          <div className="space-y-sm text-sm">
            {flags.data ? Object.entries(flags.data.effective).map(([key, on]) => (
              <div key={key} className="flex items-center justify-between"><span className="font-mono text-xs">{key}</span><div className="flex items-center gap-sm"><Badge tone={on ? 'APPROVED' : 'REJECTED'}>{on ? 'on' : 'off'}</Badge><Button variant="ghost" onClick={() => save(() => api().admin.setFlag(key, !on), flags.reload)}>Toggle</Button></div></div>
            )) : null}
          </div>
        </Card>
        <Card title="Prompt templates" className="md:col-span-2">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-ink-muted"><tr><th className="py-2">Name</th><th>Workflow</th><th>Version</th><th>Scope</th><th>Active</th><th /></tr></thead>
            <tbody className="divide-y divide-line">
              {prompts.data?.map((p) => (
                <tr key={p.id}><td className="py-2 font-mono text-xs">{p.name}</td><td>{p.workflow}</td><td>v{p.version}</td><td>{p.organizationId ? 'organisation' : 'global default'}</td><td>{p.isActive ? <Badge tone="APPROVED">active</Badge> : '—'}</td><td className="text-right">{p.organizationId && !p.isActive ? <Button variant="ghost" onClick={() => save(() => api().admin.activatePrompt(p.id), prompts.reload)}>Activate</Button> : null}</td></tr>
              ))}
            </tbody>
          </table>
          <form onSubmit={publish} className="mt-lg grid gap-md md:grid-cols-2">
            <Field label="Name" hint="lowercase, hyphens"><Input required pattern="[a-z0-9-]{3,60}" value={prompt.name} onChange={(e) => setPrompt({ ...prompt, name: e.target.value })} /></Field>
            <Field label="Workflow"><Select value={prompt.workflow} onChange={(e) => setPrompt({ ...prompt, workflow: e.target.value })}>{WORKFLOWS.map((w) => <option key={w}>{w}</option>)}</Select></Field>
            <Field label="System prompt"><Textarea required rows={6} value={prompt.systemPrompt} onChange={(e) => setPrompt({ ...prompt, systemPrompt: e.target.value })} /></Field>
            <Field label="User template" hint="Use {{variable}} placeholders matching the workflow"><Textarea required rows={6} value={prompt.userTemplate} onChange={(e) => setPrompt({ ...prompt, userTemplate: e.target.value })} /></Field>
            <Field label="Description"><Input value={prompt.description} onChange={(e) => setPrompt({ ...prompt, description: e.target.value })} /></Field>
            <label className="flex items-end gap-2 text-sm"><input type="checkbox" checked={prompt.activate} onChange={(e) => setPrompt({ ...prompt, activate: e.target.checked })} />Activate immediately</label>
            <Button type="submit">Publish new version</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
