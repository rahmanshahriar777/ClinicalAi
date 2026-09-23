import { detectRedFlags, urgencyAtLeast } from '@app/ai';
import type { Message, MessageThread, Prisma } from '@app/db';
import { type CreateThreadInput, FEATURE_FLAGS, type ListThreadsQuery, type Paginated, type SendMessageInput , updateThreadSchema } from '@app/shared';
import { Injectable, Logger } from '@nestjs/common';
import type { z } from 'zod';

import { AccessPolicyService } from '../../access/access-policy.service';
import { ForbiddenError, InvalidStateTransitionError, ValidationError } from '../../common/errors/app-error';
import { paginate, toSkipTake } from '../../common/utils/pagination';
import { FeatureFlagsService } from '../../infra/feature-flags/feature-flags.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AiConfigService } from '../ai/ai-config.service';
import { AiDraftsService } from '../ai/ai-drafts.service';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../auth/auth.types';
import { ConsentsService } from '../consents/consents.service';
import { EscalationsService } from '../escalations/escalations.service';
import { NotificationsService } from '../notifications/notifications.service';

const threadInclude = {
  patient: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
  assignedTo: { select: { id: true, firstName: true, lastName: true, role: true } },
  messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, senderType: true, body: true, createdAt: true, readAt: true } },
  _count: { select: { messages: true } },
} satisfies Prisma.MessageThreadInclude;
export type ThreadView = Prisma.MessageThreadGetPayload<{ include: typeof threadInclude }>;

/**
 * Patient ↔ care-team messaging (blueprint §4.3):
 *   Received → rule-based red flags (immediate) → AI classification (job) →
 *   routing → AI draft (on request) → human review → approved → sent.
 * EMERGENCY red flags escalate immediately and the patient receives the
 * organisation's configured emergency guidance as a SYSTEM message (§4.4).
 */
@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
    private readonly audit: AuditService,
    private readonly consents: ConsentsService,
    private readonly flags: FeatureFlagsService,
    private readonly escalations: EscalationsService,
    private readonly notifications: NotificationsService,
    private readonly drafts: AiDraftsService,
    private readonly aiConfig: AiConfigService,
  ) {}

  async listThreads(user: RequestUser, q: ListThreadsQuery): Promise<Paginated<ThreadView>> {
    const scope = await this.access.patientScope(user);
    const where: Prisma.MessageThreadWhereInput = {
      organizationId: user.organizationId,
      ...(scope === 'ALL' ? {} : scope.patientId ? { patientId: scope.patientId } : { patientId: { in: scope.patientIds ?? [] } }),
      ...(q.patientId ? { patientId: q.patientId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.urgency ? { urgency: q.urgency } : {}),
      ...(q.assignedToMe ? { assignedToUserId: user.id } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.messageThread.findMany({ where, include: threadInclude, orderBy: [{ urgency: 'desc' }, { lastMessageAt: 'desc' }], ...toSkipTake(q) }),
      this.prisma.messageThread.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async getThread(user: RequestUser, threadId: string): Promise<ThreadView & { messages: Message[] }> {
    await this.access.assertThreadAccess(user, threadId);
    const thread = await this.prisma.messageThread.findUniqueOrThrow({ where: { id: threadId }, include: { ...threadInclude, messages: { orderBy: { createdAt: 'asc' } } } });
    if (user.role !== 'PATIENT') await this.audit.log({ action: 'PHI_ACCESSED', resource: 'MessageThread', resourceId: threadId, patientId: thread.patientId });
    return thread as ThreadView & { messages: Message[] };
  }

  async createThread(user: RequestUser, input: CreateThreadInput): Promise<ThreadView & { messages: Message[] }> {
    await this.flags.assertEnabled(FEATURE_FLAGS.PATIENT_MESSAGING, user.organizationId);
    const patientId = user.role === 'PATIENT' ? user.patientId : input.patientId;
    if (!patientId) throw new ValidationError('patientId is required');
    if (user.role !== 'PATIENT' && !user.permissions.includes('message:send')) throw new ForbiddenError();
    const patient = await this.access.assertPatientAccess(user, patientId);
    await this.consents.assertGranted(patientId, 'MESSAGING');

    const thread = await this.prisma.messageThread.create({ data: { organizationId: patient.organizationId, patientId, subject: input.subject, status: user.role === 'PATIENT' ? 'TRIAGING' : 'ROUTED', assignedToUserId: user.role === 'PATIENT' ? null : user.id } });
    await this.audit.log({ action: 'THREAD_CREATED', resource: 'MessageThread', resourceId: thread.id, patientId });
    await this.sendMessage(user, thread.id, { body: input.body });
    return this.getThread(user, thread.id);
  }

  async sendMessage(user: RequestUser, threadId: string, input: SendMessageInput): Promise<Message> {
    const thread = await this.access.assertThreadAccess(user, threadId);
    if (thread.status === 'CLOSED') throw new InvalidStateTransitionError('thread', thread.status, 'post to');
    if (!user.permissions.includes('message:send')) throw new ForbiddenError();
    await this.consents.assertGranted(thread.patientId, 'MESSAGING');

    const fromPatient = user.role === 'PATIENT';
    const report = fromPatient ? detectRedFlags(input.body) : { urgency: 'LOW' as const, flags: [], negated: [] };
    const redFlags = [...new Set(report.flags.filter((f) => !f.negated).map((f) => f.category))];

    if (input.aiDraftId) {
      const d = await this.prisma.aiDraft.findUnique({ where: { id: input.aiDraftId } });
      if (!d || d.threadId !== threadId || d.status !== 'APPROVED') throw new ValidationError('aiDraftId must reference an approved draft on this thread');
    }

    const urgency = maxUrgency(thread.urgency, report.urgency);
    const emergency = urgencyAtLeast(report.urgency, 'EMERGENCY');
    const message = await this.prisma.$transaction(async (tx) => {
      const m = await tx.message.create({ data: { threadId, senderType: fromPatient ? 'PATIENT' : 'STAFF', senderId: user.id, body: input.body, redFlags, aiDrafted: Boolean(input.aiDraftId), aiDraftId: input.aiDraftId } });
      await tx.messageThread.update({
        where: { id: threadId },
        data: {
          lastMessageAt: new Date(),
          urgency,
          status: fromPatient ? (urgencyAtLeast(urgency, 'HIGH') ? 'ESCALATED' : thread.status === 'RESOLVED' ? 'TRIAGING' : thread.status === 'OPEN' ? 'TRIAGING' : thread.status) : thread.status === 'ESCALATED' ? 'ESCALATED' : 'ROUTED',
          ...(fromPatient ? {} : { assignedToUserId: thread.assignedToUserId ?? user.id }),
        },
      });
      return m;
    });
    await this.audit.log({ action: 'MESSAGE_SENT', resource: 'Message', resourceId: message.id, patientId: thread.patientId, metadata: { threadId, senderType: message.senderType, redFlags, aiDrafted: message.aiDrafted } });

    if (fromPatient) {
      if (urgencyAtLeast(report.urgency, 'HIGH')) {
        await this.escalations.raise({ organizationId: thread.organizationId, patientId: thread.patientId, threadId, source: 'MESSAGE', urgency: report.urgency, redFlags, summary: `Patient message contains red flags: ${redFlags.join(', ')}` });
      }
      if (emergency) await this.sendEmergencyGuidance(thread);
      await this.queueTriage(thread, message);
      await this.notifyStaffOfPatientMessage(thread, urgency);
    } else {
      await this.notifications.notify({ userId: thread.patient.userId, type: 'MESSAGE_REPLY', title: 'New message from your care team', body: 'Your care team has sent you a message. Open the portal to read it.', data: { threadId } });
    }
    return message;
  }

  async updateThread(user: RequestUser, threadId: string, input: z.infer<typeof updateThreadSchema>): Promise<ThreadView> {
    if (user.role === 'PATIENT') throw new ForbiddenError();
    await this.access.assertThreadAccess(user, threadId);
    if (input.assignedToUserId) {
      const assignee = await this.prisma.user.findFirst({ where: { id: input.assignedToUserId, organizationId: user.organizationId, isActive: true } });
      if (!assignee) throw new ValidationError('Unknown assignee');
    }
    return this.prisma.messageThread.update({ where: { id: threadId }, data: input, include: threadInclude });
  }

  async markRead(user: RequestUser, threadId: string): Promise<{ updated: number }> {
    await this.access.assertThreadAccess(user, threadId);
    const other: Prisma.MessageWhereInput = user.role === 'PATIENT' ? { senderType: { in: ['STAFF', 'SYSTEM'] } } : { senderType: 'PATIENT' };
    const r = await this.prisma.message.updateMany({ where: { threadId, readAt: null, ...other }, data: { readAt: new Date(), status: 'READ' } });
    if (r.count) await this.audit.log({ action: 'MESSAGE_READ', resource: 'MessageThread', resourceId: threadId, metadata: { count: r.count } });
    return { updated: r.count };
  }

  /* ---------- internals ---------- */

  private async sendEmergencyGuidance(thread: MessageThread): Promise<void> {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: thread.organizationId } });
    await this.prisma.message.create({ data: { threadId: thread.id, senderType: 'SYSTEM', body: org.emergencyGuidanceText } });
    const patient = await this.prisma.patient.findUniqueOrThrow({ where: { id: thread.patientId }, select: { userId: true } });
    await this.notifications.notify({ userId: patient.userId, type: 'SYSTEM', title: 'Important safety information', body: org.emergencyGuidanceText, data: { threadId: thread.id }, channels: ['IN_APP', 'PUSH', 'SMS'] });
  }

  private async queueTriage(thread: MessageThread, message: Message): Promise<void> {
    try {
      const policy = await this.aiConfig.forOrganization(thread.organizationId);
      if (!policy.workflows.MESSAGE_TRIAGE || !(await this.consents.isGranted(thread.patientId, 'AI_PROCESSING'))) return;
      await this.drafts.requestDraft({ requestedById: message.senderId ?? '', organizationId: thread.organizationId, patientId: thread.patientId, workflow: 'MESSAGE_TRIAGE', threadId: thread.id, systemRequested: true });
    } catch (err) {
      this.logger.warn({ err: (err as Error).message, threadId: thread.id }, 'triage not queued');
    }
  }

  private async notifyStaffOfPatientMessage(thread: MessageThread, urgency: MessageThread['urgency']): Promise<void> {
    let userIds: string[] = [];
    if (thread.assignedToUserId) userIds = [thread.assignedToUserId];
    else {
      const care = await this.prisma.careTeamAssignment.findMany({ where: { patientId: thread.patientId }, include: { clinician: { select: { userId: true } } } });
      userIds = care.map((c) => c.clinician.userId);
      if (userIds.length === 0) {
        const nurses = await this.prisma.user.findMany({ where: { organizationId: thread.organizationId, role: 'NURSE', isActive: true }, select: { id: true } });
        userIds = nurses.map((n) => n.id);
      }
    }
    await this.notifications.notifyMany(userIds, { type: 'MESSAGE_REPLY', title: `New patient message (${urgency})`, body: 'A patient has sent a message that needs attention.', data: { threadId: thread.id, urgency }, channels: ['IN_APP'] });
  }
}

const ORDER = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'] as const;
function maxUrgency<T extends (typeof ORDER)[number]>(a: T, b: T): T {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}
