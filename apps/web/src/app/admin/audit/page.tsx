'use client';

import { Button, Card, Field, Input, PageHeader } from '@app/ui';
import { useState } from 'react';

import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';

export default function AuditPage() {
  const [filters, setFilters] = useState({ action: '', resource: '', patientId: '', page: 1 });
  const logs = useApi(() => api().audit.list({ ...filters, action: filters.action || undefined, resource: filters.resource || undefined, patientId: filters.patientId || undefined, pageSize: 50 }), [filters]);
  return (
    <>
      <PageHeader title="Audit log" subtitle="Append-only record of PHI access, AI decisions and administrative changes (blueprint §11.4)." />
      <Card>
        <div className="mb-md grid gap-sm md:grid-cols-4">
          <Field label="Action"><Input value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })} placeholder="e.g. AI_DRAFT_APPROVED" /></Field>
          <Field label="Resource"><Input value={filters.resource} onChange={(e) => setFilters({ ...filters, resource: e.target.value, page: 1 })} placeholder="e.g. ClinicalDocument" /></Field>
          <Field label="Patient ID"><Input value={filters.patientId} onChange={(e) => setFilters({ ...filters, patientId: e.target.value, page: 1 })} /></Field>
          <div className="flex items-end gap-sm"><Button variant="secondary" disabled={filters.page === 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Prev</Button><Button variant="secondary" disabled={!logs.data || logs.data.page * logs.data.pageSize >= logs.data.total} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</Button></div>
        </div>
        <table className="w-full text-xs">
          <thead className="text-left uppercase text-ink-muted"><tr><th className="py-2">Time</th><th>Actor</th><th>Action</th><th>Resource</th><th>Patient</th><th>Request</th><th>Metadata</th></tr></thead>
          <tbody className="divide-y divide-line">
            {logs.data?.items.map((a) => (
              <tr key={a.id} className="align-top"><td className="py-1 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td><td>{a.actorRole ?? 'SYSTEM'}<br /><span className="text-ink-muted">{a.actorId?.slice(0, 8)}</span></td><td className="font-mono">{a.action}</td><td>{a.resource}<br /><span className="text-ink-muted">{a.resourceId?.slice(0, 8)}</span></td><td className="text-ink-muted">{a.patientId?.slice(0, 8) ?? '—'}</td><td className="text-ink-muted">{a.requestId?.slice(0, 8) ?? '—'}</td><td className="max-w-xs truncate font-mono text-ink-muted">{a.metadata ? JSON.stringify(a.metadata) : ''}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="mt-sm text-xs text-ink-muted">{logs.data ? `${logs.data.total} events` : ''}</p>
      </Card>
    </>
  );
}
