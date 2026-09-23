import type { Escalation, EscalationSource, Prisma, UrgencyLevel } from '@app/db';
import type { Paginated, PaginationQuery } from '@app/shared';
import { Injectable } from '@nestjs/common';

import { InvalidStateTransitionError, NotFoundError } from '../../common/errors/app-error';
import { paginate, toSkipTake } from '../../common/utils/pagination';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';

export interface RaiseEscalationInput {
  organizationId: string;
  patientId: string;
  threadId?: string | null;
  source: EscalationSource;
  urgency: UrgencyLevel;
  redFlags: string[];
  summary: string;
}

/**
 * Red-flag escalation workflow (blueprint §4.4):
 *   detect → human review queue (this table) → notify care team →
 *   patient receives the organisation's configured emergency guidance
 *   (sent by the caller into the thread when source=MESSAGE).
 */
@Injectable()
export class EscalationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async raise(input: RaiseEscalationInput): Promise<Escalation> {
    // De-duplicate: one OPEN escalation per patient+thread+source.
    const existing = await this.prisma.escalation.findFirst({ where: { patientId: input.patientId, threadId: input.threadId ?? null, source: input.source, status: 'OPEN' } });
    if (existing) {
      return this.prisma.escalation.update({
        where: { id: existing.id },
        data: { urgency: maxUrgency(existing.urgency, input.urgency), redFlags: [...new Set([...existing.redFlags, ...input.redFlags])], summary: input.summary },
      });
    }
    const esc = await this.prisma.escalation.create({ data: { ...input, threadId: input.threadId ?? null } });
    await this.audit.log({ action: 'ESCALATION_CREATED', resource: 'Escalation', resourceId: esc.id, patientId: input.patientId, organizationId: input.organizationId, actorId: null, actorRole: 'SYSTEM', metadata: { source: input.source, urgency: input.urgency, redFlags: input.redFlags } });
    await this.notifyCareTeam(esc);
    return esc;
  }

  /** Care team first; if none, every clinician and nurse in the organisation. */
  private async notifyCareTeam(esc: Escalation): Promise<void> {
    const care = await this.prisma.careTeamAssignment.findMany({ where: { patientId: esc.patientId }, include: { clinician: { select: { userId: true } } } });
    let userIds = care.map((c) => c.clinician.userId);
    if (userIds.length === 0) {
      const staff = await this.prisma.user.findMany({ where: { organizationId: esc.organizationId, isActive: true, role: { in: ['CLINICIAN', 'NURSE'] } }, select: { id: true } });
      userIds = staff.map((s) => s.id);
    }
    await this.notifications.notifyMany(userIds, {
      type: 'ESCALATION_ALERT',
      title: `${esc.urgency} escalation requires review`,
      body: `A ${esc.source.toLowerCase()} red flag was detected (${esc.redFlags.join(', ') || 'see queue'}). Open the escalation queue to review.`,
      data: { escalationId: esc.id, patientId: esc.patientId, threadId: esc.threadId, urgency: esc.urgency },
      channels: ['IN_APP', 'PUSH'],
    });
  }

  async list(user: RequestUser, q: PaginationQuery & { status?: string; urgency?: string }): Promise<Paginated<Escalation>> {
    const where: Prisma.EscalationWhereInput = {
      organizationId: user.organizationId,
      ...(q.status ? { status: q.status as Escalation['status'] } : {}),
      ...(q.urgency ? { urgency: q.urgency as UrgencyLevel } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.escalation.findMany({ where, orderBy: [{ status: 'asc' }, { urgency: 'desc' }, { createdAt: 'asc' }], include: { patient: { select: { id: true, user: { select: { firstName: true, lastName: true } } } } }, ...toSkipTake(q) }),
      this.prisma.escalation.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async acknowledge(user: RequestUser, id: string): Promise<Escalation> {
    const esc = await this.get(user, id);
    if (esc.status !== 'OPEN') throw new InvalidStateTransitionError('escalation', esc.status, 'acknowledge');
    const updated = await this.prisma.escalation.update({ where: { id }, data: { status: 'ACKNOWLEDGED', acknowledgedById: user.id, acknowledgedAt: new Date() } });
    await this.audit.log({ action: 'ESCALATION_ACKNOWLEDGED', resource: 'Escalation', resourceId: id, patientId: esc.patientId });
    return updated;
  }

  async resolve(user: RequestUser, id: string, notes: string, dismissed = false): Promise<Escalation> {
    const esc = await this.get(user, id);
    if (esc.status === 'RESOLVED' || esc.status === 'DISMISSED') throw new InvalidStateTransitionError('escalation', esc.status, 'resolve');
    const updated = await this.prisma.escalation.update({
      where: { id },
      data: { status: dismissed ? 'DISMISSED' : 'RESOLVED', resolvedAt: new Date(), resolutionNotes: notes, acknowledgedById: esc.acknowledgedById ?? user.id, acknowledgedAt: esc.acknowledgedAt ?? new Date() },
    });
    if (esc.threadId) {
      await this.prisma.messageThread.updateMany({ where: { id: esc.threadId, status: 'ESCALATED' }, data: { status: 'ROUTED' } });
    }
    await this.audit.log({ action: 'ESCALATION_RESOLVED', resource: 'Escalation', resourceId: id, patientId: esc.patientId, metadata: { dismissed } });
    return updated;
  }

  private async get(user: RequestUser, id: string): Promise<Escalation> {
    const esc = await this.prisma.escalation.findUnique({ where: { id } });
    if (!esc || esc.organizationId !== user.organizationId) throw new NotFoundError('Escalation', id);
    return esc;
  }
}

const ORDER: UrgencyLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];
function maxUrgency(a: UrgencyLevel, b: UrgencyLevel): UrgencyLevel {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}
