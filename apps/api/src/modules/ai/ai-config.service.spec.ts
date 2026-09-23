import type { Env } from '../../config/env';

import { AiConfigService } from './ai-config.service';

const env = { AI_PROVIDER: 'mock', EXTERNAL_AI_ALLOWED: false, ENABLE_PHI_REDACTION: true, REQUIRE_CLINICIAN_APPROVAL: true, AI_TEMPERATURE: 0.2, AI_MAX_TOKENS: 2048 } as Env;

function svc(orgRow: Record<string, unknown> | null, e: Partial<Env> = {}) {
  const prisma = { organizationAiConfig: { findUnique: jest.fn(async () => orgRow) } } as never;
  return new AiConfigService(prisma, { ...env, ...e });
}

describe('AiConfigService — organisations can only tighten environment policy', () => {
  it('org cannot enable external AI when the deployment forbids it', async () => {
    const p = await svc({ externalAiAllowed: true })!.forOrganization('org');
    expect(p.externalAiAllowed).toBe(false);
  });

  it('org can disable external AI when the deployment allows it', async () => {
    const p = await svc({ externalAiAllowed: false }, { EXTERNAL_AI_ALLOWED: true }).forOrganization('org');
    expect(p.externalAiAllowed).toBe(false);
    const q = await svc(null, { EXTERNAL_AI_ALLOWED: true }).forOrganization('org');
    expect(q.externalAiAllowed).toBe(true);
  });

  it('org cannot turn off redaction or clinician approval when the deployment requires them', async () => {
    const p = await svc({ phiRedactionEnabled: false, requireClinicianApproval: false }).forOrganization('org');
    expect(p.phiRedactionEnabled).toBe(true);
    expect(p.requireClinicianApproval).toBe(true);
  });

  it('org can require clinician approval when the deployment does not', async () => {
    const p = await svc({ requireClinicianApproval: true }, { REQUIRE_CLINICIAN_APPROVAL: false }).forOrganization('org');
    expect(p.requireClinicianApproval).toBe(true);
  });

  it('per-workflow switches default on', async () => {
    const p = await svc({ workflows: { PATIENT_EDUCATION: false } }).forOrganization('org');
    expect(p.workflows.PATIENT_EDUCATION).toBe(false);
    expect(p.workflows.CLINICAL_NOTE).toBe(true);
  });
});
