'use client';

import { Card, PageHeader } from '@app/ui';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/use-api';

export default function AdminHome() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const metrics = useApi(() => (isAdmin ? api().admin.aiMetrics(30) : Promise.resolve(null)), [isAdmin]);
  const audit = useApi(() => api().audit.list({ pageSize: 10 }));
  const rows = metrics.data ? Object.entries(metrics.data.byWorkflow as Record<string, Record<string, number | null>>) : [];
  return (
    <>
      <PageHeader title="Overview" subtitle={isAdmin ? 'AI governance metrics for the last 30 days (blueprint §17, §23.4)' : 'Compliance view'} />
      {isAdmin ? (
        <Card title="AI drafts by workflow" className="mb-lg">
          {rows.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-ink-muted"><tr><th className="py-2">Workflow</th><th>Total</th><th>Approved</th><th>With edits</th><th>Rejected</th><th>Failed</th><th>Pending</th><th>Avg edit distance</th><th>Avg latency</th><th>Safety flagged</th><th>Cost (USD)</th></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map(([wf, m]) => (
                  <tr key={wf}><td className="py-2 font-medium">{wf.replace(/_/g, ' ').toLowerCase()}</td><td>{m.total}</td><td>{m.approved}</td><td>{m.approvedWithEdits}</td><td>{m.rejected}</td><td>{m.failed}</td><td>{m.pending}</td><td>{m.avgEditDistance == null ? '—' : `${((m.avgEditDistance as number) * 100).toFixed(0)}%`}</td><td>{m.avgLatencyMs ?? '—'} ms</td><td>{m.safetyFlagged}</td><td>{(m.totalCost as number).toFixed(3)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-ink-muted">No AI activity in the period.</p>
          )}
        </Card>
      ) : null}
      <Card title="Recent audit events">
        <ul className="divide-y divide-line text-sm">
          {audit.data?.items.map((a) => (
            <li key={a.id} className="flex justify-between py-1"><span><span className="font-mono text-xs">{a.action}</span> · {a.resource} {a.resourceId ? <span className="text-ink-muted">{String(a.resourceId).slice(0, 8)}…</span> : null}</span><span className="text-xs text-ink-muted">{a.actorRole ?? 'SYSTEM'} · {new Date(a.createdAt).toLocaleString()}</span></li>
          ))}
        </ul>
      </Card>
    </>
  );
}
