import type { Organization, Prisma, User } from '@app/db';
import type { AiConfigInput, CreateUserInput, Paginated , createOrganizationSchema, featureFlagSchema, listUsersQuerySchema, updateOrganizationSchema, updateUserSchema } from '@app/shared';
import { Inject, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import type { z } from 'zod';

import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../common/errors/app-error';
import { paginate, toSkipTake } from '../../common/utils/pagination';
import { ENV, type Env } from '../../config/env';
import { FeatureFlagsService } from '../../infra/feature-flags/feature-flags.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AiConfigService } from '../ai/ai-config.service';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../auth/auth.types';

const userSelect = { id: true, organizationId: true, email: true, role: true, firstName: true, lastName: true, phone: true, isActive: true, mfaEnabled: true, lastLoginAt: true, createdAt: true, clinician: { select: { id: true, specialty: true } }, patient: { select: { id: true } } } satisfies Prisma.UserSelect;
type UserView = Prisma.UserGetPayload<{ select: typeof userSelect }>;

/** Admin console operations (blueprint §5.4). Admins are scoped to their own organisation. */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly flags: FeatureFlagsService,
    private readonly aiConfig: AiConfigService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /* ---------- users ---------- */

  async listUsers(admin: RequestUser, q: z.infer<typeof listUsersQuerySchema>): Promise<Paginated<UserView>> {
    const where: Prisma.UserWhereInput = {
      organizationId: admin.organizationId,
      ...(q.role ? { role: q.role } : {}),
      ...(q.search ? { OR: [{ email: { contains: q.search, mode: 'insensitive' } }, { firstName: { contains: q.search, mode: 'insensitive' } }, { lastName: { contains: q.search, mode: 'insensitive' } }] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, select: userSelect, orderBy: [{ role: 'asc' }, { lastName: 'asc' }], ...toSkipTake(q) }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async createUser(admin: RequestUser, input: CreateUserInput): Promise<UserView> {
    if (input.role === 'PATIENT') throw new ValidationError('Patients register through /auth/register or the front desk patient flow');
    if (this.env.AUTH_MODE === 'local' && !input.password) throw new ValidationError('password is required in local auth mode');
    if (this.env.AUTH_MODE === 'oidc' && !input.externalId && !this.env.AUTH_OIDC_JIT_PROVISION) throw new ValidationError('externalId is required in OIDC mode unless JIT provisioning is enabled');
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictError('Email already in use');
    const passwordHash = input.password ? await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 }) : null;
    const user = await this.prisma.user.create({
      data: {
        organizationId: admin.organizationId,
        email: input.email,
        role: input.role,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash,
        externalId: input.externalId,
        ...(input.role === 'CLINICIAN' ? { clinician: { create: { organizationId: admin.organizationId, specialty: input.clinician?.specialty, licenseInfo: input.clinician?.licenseInfo } } } : {}),
      },
      select: userSelect,
    });
    await this.audit.log({ action: 'USER_CREATED', resource: 'User', resourceId: user.id, metadata: { role: user.role } });
    return user;
  }

  async updateUser(admin: RequestUser, id: string, input: z.infer<typeof updateUserSchema>): Promise<UserView> {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId: admin.organizationId } });
    if (!user) throw new NotFoundError('User', id);
    if (id === admin.id && (input.isActive === false || (input.role && input.role !== 'ADMIN'))) throw new ForbiddenError('You cannot deactivate or demote yourself');
    if (input.role && input.role !== user.role && (user.role === 'PATIENT' || input.role === 'PATIENT')) throw new ValidationError('Patients cannot be converted to staff roles or vice versa');
    const updated = await this.prisma.user.update({ where: { id }, data: input, select: userSelect });
    if (input.role && input.role !== user.role) await this.audit.log({ action: 'PERMISSION_CHANGED', resource: 'User', resourceId: id, metadata: { from: user.role, to: input.role } });
    if (input.isActive === false) {
      await this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.log({ action: 'USER_DEACTIVATED', resource: 'User', resourceId: id });
    } else {
      await this.audit.log({ action: 'USER_UPDATED', resource: 'User', resourceId: id, metadata: { fields: Object.keys(input) } });
    }
    return updated;
  }

  /* ---------- organisation ---------- */

  async getOrganization(admin: RequestUser): Promise<Organization> {
    return this.prisma.organization.findUniqueOrThrow({ where: { id: admin.organizationId } });
  }

  async updateOrganization(admin: RequestUser, input: z.infer<typeof updateOrganizationSchema>): Promise<Organization> {
    const { slug: _slug, ...data } = input; // slug is immutable after creation
    return this.prisma.organization.update({ where: { id: admin.organizationId }, data });
  }

  async createOrganization(input: z.infer<typeof createOrganizationSchema>): Promise<Organization> {
    return this.prisma.organization.create({ data: input });
  }

  /* ---------- AI config ---------- */

  async getAiConfig(admin: RequestUser) {
    const [row, effective] = await Promise.all([this.prisma.organizationAiConfig.findUnique({ where: { organizationId: admin.organizationId } }), this.aiConfig.forOrganization(admin.organizationId)]);
    return { stored: row, effective, environment: { provider: this.env.AI_PROVIDER, externalAiAllowed: this.env.EXTERNAL_AI_ALLOWED, phiRedactionEnabled: this.env.ENABLE_PHI_REDACTION, requireClinicianApproval: this.env.REQUIRE_CLINICIAN_APPROVAL } };
  }

  async updateAiConfig(admin: RequestUser, input: AiConfigInput) {
    const data = { ...input, workflows: input.workflows as Prisma.InputJsonValue | undefined };
    const row = await this.prisma.organizationAiConfig.upsert({ where: { organizationId: admin.organizationId }, create: { organizationId: admin.organizationId, ...data }, update: data });
    this.aiConfig.invalidate(admin.organizationId);
    await this.audit.log({ action: 'AI_CONFIG_UPDATED', resource: 'OrganizationAiConfig', resourceId: row.id, metadata: { fields: Object.keys(input) } });
    return this.getAiConfig(admin);
  }

  /* ---------- feature flags ---------- */

  async listFlags(admin: RequestUser) {
    const [rows, effective] = await Promise.all([this.prisma.featureFlag.findMany({ where: { OR: [{ organizationId: null }, { organizationId: admin.organizationId }] } }), this.flags.listEffective(admin.organizationId)]);
    return { rows, effective };
  }

  async setFlag(admin: RequestUser, input: z.infer<typeof featureFlagSchema>) {
    const organizationId = input.organizationId === undefined ? admin.organizationId : input.organizationId;
    if (organizationId !== null && organizationId !== admin.organizationId) throw new ForbiddenError();
    const existing = await this.prisma.featureFlag.findFirst({ where: { key: input.key, organizationId } });
    const row = existing ? await this.prisma.featureFlag.update({ where: { id: existing.id }, data: { enabled: input.enabled } }) : await this.prisma.featureFlag.create({ data: { key: input.key, organizationId, enabled: input.enabled } });
    this.flags.invalidate();
    await this.audit.log({ action: 'FEATURE_FLAG_UPDATED', resource: 'FeatureFlag', resourceId: row.id, metadata: { key: input.key, enabled: input.enabled, organizationId } });
    return row;
  }

  /* ---------- AI metrics (blueprint §17.3, §23.4) ---------- */

  async aiMetrics(admin: RequestUser, days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const drafts = await this.prisma.aiDraft.findMany({
      where: { createdAt: { gte: since }, OR: [{ encounter: { appointment: { organizationId: admin.organizationId } } }, { thread: { organizationId: admin.organizationId } }, { intakeForm: { appointment: { organizationId: admin.organizationId } } }] },
      select: { workflow: true, status: true, confidence: true, safetyFlags: true, approvals: { select: { decision: true, editDistance: true } }, invocation: { select: { latencyMs: true, costEstimate: true, status: true, injectionSignals: true } } },
    });
    const byWorkflow: Record<string, { total: number; approved: number; approvedWithEdits: number; rejected: number; failed: number; pending: number; avgEditDistance: number | null; avgLatencyMs: number | null; totalCost: number; safetyFlagged: number; injectionSignals: number }> = {};
    for (const d of drafts) {
      const b = (byWorkflow[d.workflow] ??= { total: 0, approved: 0, approvedWithEdits: 0, rejected: 0, failed: 0, pending: 0, avgEditDistance: null, avgLatencyMs: null, totalCost: 0, safetyFlagged: 0, injectionSignals: 0 });
      b.total++;
      const a = d.approvals[0];
      if (a?.decision === 'APPROVED') b.approved++;
      else if (a?.decision === 'APPROVED_WITH_EDITS') b.approvedWithEdits++;
      else if (a?.decision === 'REJECTED') b.rejected++;
      if (d.status === 'FAILED') b.failed++;
      if (d.status === 'PENDING_REVIEW') b.pending++;
      if (d.safetyFlags.length) b.safetyFlagged++;
      if (d.invocation?.injectionSignals.length) b.injectionSignals++;
      b.totalCost += d.invocation?.costEstimate ?? 0;
    }
    for (const [wf, b] of Object.entries(byWorkflow)) {
      const ds = drafts.filter((d) => d.workflow === wf);
      const eds = ds.flatMap((d) => d.approvals.map((a) => a.editDistance)).filter((x): x is number => typeof x === 'number');
      const lats = ds.map((d) => d.invocation?.latencyMs).filter((x): x is number => typeof x === 'number');
      b.avgEditDistance = eds.length ? eds.reduce((s, x) => s + x, 0) / eds.length : null;
      b.avgLatencyMs = lats.length ? Math.round(lats.reduce((s, x) => s + x, 0) / lats.length) : null;
    }
    return { since, byWorkflow };
  }

  async exportAudit(admin: RequestUser, from: Date, to: Date): Promise<User[]> {
    void admin; void from; void to;
    throw new ValidationError('Use GET /audit-logs with pagination for exports');
  }
}
