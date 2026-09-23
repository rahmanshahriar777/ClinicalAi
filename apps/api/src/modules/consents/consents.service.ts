import type { Consent } from '@app/db';
import type { ConsentType, RecordConsentInput } from '@app/shared';
import { Injectable } from '@nestjs/common';

import { ConsentRequiredError } from '../../common/errors/app-error';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Consent ledger (blueprint §11.4, §13.1 stage 2). Consents are append-only
 * events; the latest row per type is the current state. AI processing of a
 * patient's data requires AI_PROCESSING = GRANTED; messaging requires MESSAGING.
 */
@Injectable()
export class ConsentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(patientId: string): Promise<Consent[]> {
    return this.prisma.consent.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } });
  }

  /** Latest consent per type. */
  async current(patientId: string): Promise<Record<string, Consent>> {
    const rows = await this.list(patientId);
    const out: Record<string, Consent> = {};
    for (const r of rows) if (!out[r.type]) out[r.type] = r;
    return out;
  }

  async record(patientId: string, input: RecordConsentInput, actorId: string, client: { ipAddress?: string; userAgent?: string }): Promise<Consent> {
    const now = new Date();
    const consent = await this.prisma.consent.create({
      data: {
        patientId,
        type: input.type,
        status: input.status,
        version: input.version,
        grantedAt: input.status === 'GRANTED' ? now : null,
        revokedAt: input.status === 'REVOKED' ? now : null,
        ipAddress: client.ipAddress,
        userAgent: client.userAgent?.slice(0, 512),
      },
    });
    const action = input.status === 'GRANTED' ? 'CONSENT_GRANTED' : input.status === 'REVOKED' ? 'CONSENT_REVOKED' : 'CONSENT_DECLINED';
    await this.audit.log({ action, resource: 'Consent', resourceId: consent.id, patientId, actorId, metadata: { type: input.type, version: input.version } });
    return consent;
  }

  async isGranted(patientId: string, type: ConsentType): Promise<boolean> {
    const latest = await this.prisma.consent.findFirst({ where: { patientId, type }, orderBy: { createdAt: 'desc' } });
    return latest?.status === 'GRANTED';
  }

  async assertGranted(patientId: string, type: ConsentType): Promise<void> {
    if (!(await this.isGranted(patientId, type))) throw new ConsentRequiredError(type);
  }
}
