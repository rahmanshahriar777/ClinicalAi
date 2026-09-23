import type { AiWorkflow } from '@app/shared';
import { Inject, Injectable } from '@nestjs/common';

import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface EffectiveAiPolicy {
  provider: Env['AI_PROVIDER'];
  externalAiAllowed: boolean;
  phiRedactionEnabled: boolean;
  requireClinicianApproval: boolean;
  temperature: number;
  maxTokens: number;
  workflows: Record<AiWorkflow, boolean>;
}

const CACHE_TTL_MS = 30_000;

/**
 * Effective AI policy per organisation = environment hard limits merged with
 * the organisation's OrganizationAiConfig. Organisations can only make policy
 * stricter than the deployment (blueprint §11.5 "EXTERNAL_AI_ALLOWED" is a
 * hard gate): they can disable external AI, force redaction, or require
 * clinician approval — never the reverse.
 */
@Injectable()
export class AiConfigService {
  private cache = new Map<string, { value: EffectiveAiPolicy; expires: number }>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async forOrganization(organizationId: string): Promise<EffectiveAiPolicy> {
    const hit = this.cache.get(organizationId);
    if (hit && hit.expires > Date.now()) return hit.value;
    const org = await this.prisma.organizationAiConfig.findUnique({ where: { organizationId } });
    const wf = (org?.workflows ?? {}) as Partial<Record<AiWorkflow, boolean>>;
    const value: EffectiveAiPolicy = {
      provider: (org?.provider as Env['AI_PROVIDER'] | null) ?? this.env.AI_PROVIDER,
      externalAiAllowed: this.env.EXTERNAL_AI_ALLOWED && (org?.externalAiAllowed ?? true),
      phiRedactionEnabled: this.env.ENABLE_PHI_REDACTION || (org?.phiRedactionEnabled ?? false),
      requireClinicianApproval: this.env.REQUIRE_CLINICIAN_APPROVAL || (org?.requireClinicianApproval ?? false),
      temperature: org?.temperature ?? this.env.AI_TEMPERATURE,
      maxTokens: org?.maxTokens ?? this.env.AI_MAX_TOKENS,
      workflows: {
        CLINICAL_NOTE: wf.CLINICAL_NOTE ?? true,
        PATIENT_MESSAGE_DRAFT: wf.PATIENT_MESSAGE_DRAFT ?? true,
        INTAKE_SUMMARY: wf.INTAKE_SUMMARY ?? true,
        PATIENT_EDUCATION: wf.PATIENT_EDUCATION ?? true,
        MESSAGE_TRIAGE: wf.MESSAGE_TRIAGE ?? true,
      },
    };
    this.cache.set(organizationId, { value, expires: Date.now() + CACHE_TTL_MS });
    return value;
  }

  invalidate(organizationId?: string): void {
    if (organizationId) this.cache.delete(organizationId);
    else this.cache.clear();
  }
}
