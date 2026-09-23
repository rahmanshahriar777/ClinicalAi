import type { AuditLog, Prisma } from '@app/db';
import type { AuditAction, AuditLogQuery, Paginated } from '@app/shared';
import { Injectable, Logger } from '@nestjs/common';

import { paginate, toSkipTake } from '../../common/utils/pagination';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { getRequestContext } from '../../infra/request-context/request-context';

export interface AuditEntry {
  action: AuditAction;
  resource: string;
  resourceId?: string | null;
  patientId?: string | null;
  organizationId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  /** Non-PHI metadata only (ids, statuses, counts, hashes). */
  metadata?: Record<string, unknown>;
}

/**
 * Immutable audit trail (blueprint §11.4). Every PHI access and AI decision is
 * written here. Failures to write audit are logged loudly but never mask the
 * business operation (the DB row is the record of truth; the app log is the
 * secondary channel). Rows are append-only: there is no update/delete API.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    const ctx = getRequestContext();
    const data: Prisma.AuditLogUncheckedCreateInput = {
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId ?? null,
      patientId: entry.patientId ?? null,
      organizationId: entry.organizationId ?? ctx.organizationId ?? null,
      actorId: entry.actorId === undefined ? (ctx.userId ?? null) : entry.actorId,
      actorRole: entry.actorRole === undefined ? (ctx.role ?? null) : entry.actorRole,
      metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent?.slice(0, 512) ?? null,
      requestId: ctx.requestId ?? null,
    };
    try {
      await (tx ?? this.prisma).auditLog.create({ data });
    } catch (err) {
      this.logger.error({ err, action: entry.action, resource: entry.resource }, 'AUDIT WRITE FAILED');
    }
  }

  async query(organizationId: string | null, q: AuditLogQuery): Promise<Paginated<AuditLog>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(organizationId ? { organizationId } : {}),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.action ? { action: q.action } : {}),
      ...(q.resource ? { resource: q.resource } : {}),
      ...(q.resourceId ? { resourceId: q.resourceId } : {}),
      ...(q.patientId ? { patientId: q.patientId } : {}),
      ...(q.from || q.to ? { createdAt: { gte: q.from, lte: q.to } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...toSkipTake(q) }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(items, total, q);
  }
}
