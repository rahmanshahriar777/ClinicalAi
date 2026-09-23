import { AiError, type AiGateway, normalizedEditDistance, urgencyAtLeast } from '@app/ai';
import type { AiDraft, AiInvocationStatus, Approval, Prisma, UrgencyLevel } from '@app/db';
import { type AiWorkflow, FEATURE_FLAGS, type GenerateDraftInput, type MessageTriageOutput, type Paginated, type PaginationQuery, type PatientMessageDraftOutput, type ReviewDraftInput } from '@app/shared';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { AccessPolicyService } from '../../access/access-policy.service';
import { AiBlockedError, ConflictError, ForbiddenError, InvalidStateTransitionError, NotFoundError, ValidationError } from '../../common/errors/app-error';
import { FeatureFlagsService } from '../../infra/feature-flags/feature-flags.service';
import { JobsService } from '../../infra/jobs/jobs.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../auth/auth.types';
import { ConsentsService } from '../consents/consents.service';
import { EscalationsService } from '../escalations/escalations.service';
import { NotificationsService } from '../notifications/notifications.service';

import { AiConfigService } from './ai-config.service';
import { AI_GATEWAY } from './ai-gateway.provider';
import { ContextBuilderService, type DraftOptions } from './context-builder.service';
import { canReviewDraft, isAdvisoryWorkflow } from './draft-review-rules';
import { PromptRegistryService } from './prompt-registry.service';

export interface RequestDraftInput {
  requestedById: string;
  organizationId: string;
  patientId: string;
  workflow: AiWorkflow;
  encounterId?: string;
  threadId?: string;
  intakeFormId?: string;
  promptName?: string;
  options?: DraftOptions;
  /** Set for pipeline-triggered drafts (intake summary, triage) where no user "invoked" AI. */
  systemRequested?: boolean;
}

const draftInclude = {
  approvals: { orderBy: { createdAt: 'desc' }, include: { reviewer: { select: { id: true, firstName: true, lastName: true, role: true } } } },
  requestedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
  invocation: { select: { latencyMs: true, inputTokens: true, outputTokens: true, costEstimate: true, redactedEntityCount: true, injectionSignals: true } },
} satisfies Prisma.AiDraftInclude;
export type AiDraftView = Prisma.AiDraftGetPayload<{ include: typeof draftInclude }>;

/**
 * AI draft lifecycle (blueprint §13.1 stages 1–3 and 11–13):
 *   request  → permission, consent, feature, policy checks; QUEUED row; job
 *   process  → context → gateway → AiInvocation + output; PENDING_REVIEW;
 *              red flags escalate; requester notified
 *   review   → APPROVED / APPROVED_WITH_EDITS / REJECTED by an authorised
 *              human; edit distance recorded for the eval framework (§17)
 * Nothing generated here reaches a patient without an approval row.
 */
@Injectable()
export class AiDraftsService implements OnModuleInit {
  private readonly logger = new Logger(AiDraftsService.name);
  private readonly draftOptions = new Map<string, DraftOptions>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
    private readonly audit: AuditService,
    private readonly consents: ConsentsService,
    private readonly flags: FeatureFlagsService,
    private readonly jobs: JobsService,
    private readonly aiConfig: AiConfigService,
    private readonly prompts: PromptRegistryService,
    private readonly context: ContextBuilderService,
    private readonly escalations: EscalationsService,
    private readonly notifications: NotificationsService,
    @Inject(AI_GATEWAY) private readonly gateway: AiGateway,
  ) {}

  onModuleInit(): void {
    this.jobs.register('AI_DRAFT_GENERATE', ({ draftId }) => this.process(draftId));
  }

  /* ------------------------------------------------------------------ */
  /* Requesting                                                           */
  /* ------------------------------------------------------------------ */

  async requestForEncounter(user: RequestUser, encounterId: string, input: GenerateDraftInput): Promise<AiDraft> {
    if (input.workflow !== 'CLINICAL_NOTE' && input.workflow !== 'PATIENT_EDUCATION') throw new ValidationError('Encounter drafts must be CLINICAL_NOTE or PATIENT_EDUCATION');
    if (user.role !== 'CLINICIAN') throw new ForbiddenError('Only the treating clinician can request encounter drafts');
    const enc = await this.access.assertEncounterAccess(user, encounterId);
    const flag = input.workflow === 'CLINICAL_NOTE' ? FEATURE_FLAGS.AI_NOTES : FEATURE_FLAGS.PATIENT_EDUCATION;
    await this.flags.assertEnabled(flag, enc.appointment.organizationId);
    return this.requestDraft({ requestedById: user.id, organizationId: enc.appointment.organizationId, patientId: enc.appointment.patientId, workflow: input.workflow, encounterId, promptName: input.promptName, options: input.options });
  }

  async requestForThread(user: RequestUser, threadId: string, input: GenerateDraftInput): Promise<AiDraft> {
    if (input.workflow !== 'PATIENT_MESSAGE_DRAFT') throw new ValidationError('Thread drafts must be PATIENT_MESSAGE_DRAFT');
    const thread = await this.access.assertThreadAccess(user, threadId);
    await this.flags.assertEnabled(FEATURE_FLAGS.AI_MESSAGE_DRAFTS, thread.organizationId);
    return this.requestDraft({ requestedById: user.id, organizationId: thread.organizationId, patientId: thread.patientId, workflow: 'PATIENT_MESSAGE_DRAFT', threadId, promptName: input.promptName, options: input.options });
  }

  /** Core entry point used by controllers and by pipeline triggers (intake, messaging). */
  async requestDraft(input: RequestDraftInput): Promise<AiDraft> {
    // Stage 2: consent. Stage 3: feature/policy.
    await this.consents.assertGranted(input.patientId, 'AI_PROCESSING');
    const policy = await this.aiConfig.forOrganization(input.organizationId);
    if (!policy.workflows[input.workflow]) throw new AiBlockedError(`Workflow ${input.workflow} is disabled for this organisation`);

    const prompt = await this.prompts.resolve(input.organizationId, input.workflow, input.promptName);

    // Supersede any earlier pending draft for the same target/workflow so reviewers see one item.
    await this.prisma.aiDraft.updateMany({
      where: { workflow: input.workflow, status: { in: ['QUEUED', 'GENERATING', 'PENDING_REVIEW'] }, encounterId: input.encounterId ?? null, threadId: input.threadId ?? null, intakeFormId: input.intakeFormId ?? null },
      data: { status: 'SUPERSEDED' },
    });

    const draft = await this.prisma.aiDraft.create({
      data: { workflow: input.workflow, status: 'QUEUED', requestedById: input.requestedById, encounterId: input.encounterId, threadId: input.threadId, intakeFormId: input.intakeFormId, promptName: prompt.name, promptVersion: prompt.version },
    });
    if (input.options) this.draftOptions.set(draft.id, input.options);
    await this.audit.log({ action: 'AI_DRAFT_REQUESTED', resource: 'AiDraft', resourceId: draft.id, patientId: input.patientId, organizationId: input.organizationId, actorId: input.systemRequested ? null : input.requestedById, actorRole: input.systemRequested ? 'SYSTEM' : undefined, metadata: { workflow: input.workflow, prompt: `${prompt.name}@${prompt.version}` } });
    await this.jobs.enqueue('AI_DRAFT_GENERATE', { draftId: draft.id });
    return draft;
  }

  /* ------------------------------------------------------------------ */
  /* Processing (job handler)                                             */
  /* ------------------------------------------------------------------ */

  async process(draftId: string): Promise<void> {
    const draft = await this.prisma.aiDraft.findUnique({ where: { id: draftId } });
    if (!draft || draft.status !== 'QUEUED') return;
    await this.prisma.aiDraft.update({ where: { id: draftId }, data: { status: 'GENERATING' } });
    const options = this.draftOptions.get(draftId) ?? {};
    this.draftOptions.delete(draftId);

    let ctx: Awaited<ReturnType<ContextBuilderService['build']>> | undefined;
    try {
      ctx = await this.context.build(draft, options);
      const policy = await this.aiConfig.forOrganization(ctx.organizationId);
      const prompt = await this.prompts.resolve(ctx.organizationId, draft.workflow, draft.promptName);
      const workflow = draft.workflow as AiWorkflow;

      const result = await this.gateway.generate({
        workflow,
        prompt,
        variables: ctx.variables,
        untrustedVariables: ctx.untrustedVariables,
        knownPhi: ctx.knownPhi,
        policy: { externalAiAllowed: policy.externalAiAllowed, phiRedactionEnabled: policy.phiRedactionEnabled, temperature: policy.temperature, maxTokens: policy.maxTokens },
        metadata: { draftId },
      });

      const invocation = await this.prisma.aiInvocation.create({
        data: {
          workflow, provider: result.provider, model: result.model, promptName: result.promptName, promptVersion: result.promptVersion, inputHash: result.inputHash,
          inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, costEstimate: result.usage.costEstimate, latencyMs: result.latencyMs, status: 'SUCCESS',
          redactionApplied: result.redaction.applied, redactedEntityCount: result.redaction.entityCount, injectionSignals: result.injectionSignals,
          metadata: { attempts: result.attempts, redactionLabels: result.redaction.labels, ruleRedFlags: result.redFlags.map((f) => f.category) },
        },
      });

      const advisory = isAdvisoryWorkflow(workflow);
      const safetyFlags = [...new Set([...result.safetyFlags, ...result.redFlags.filter((f) => !f.negated).map((f) => `red_flag:${f.category}`)])];
      const updated = await this.prisma.aiDraft.update({
        where: { id: draftId },
        data: { status: advisory ? 'APPROVED' : 'PENDING_REVIEW', output: result.output as Prisma.InputJsonValue, provider: result.provider, model: result.model, inputHash: result.inputHash, confidence: result.confidence, safetyFlags, redactionApplied: result.redaction.applied, invocationId: invocation.id, reviewedAt: advisory ? new Date() : null },
      });
      await this.audit.log({ action: 'AI_DRAFT_GENERATED', resource: 'AiDraft', resourceId: draftId, patientId: ctx.patientId, organizationId: ctx.organizationId, actorId: null, actorRole: 'SYSTEM', metadata: { workflow, provider: result.provider, model: result.model, prompt: `${result.promptName}@${result.promptVersion}`, inputHash: result.inputHash, latencyMs: result.latencyMs, safetyFlags, injectionSignals: result.injectionSignals, redacted: result.redaction.entityCount } });

      await this.postProcess(updated, ctx, result.output);
    } catch (err) {
      const aiErr = err instanceof AiError ? err : undefined;
      const status: AiInvocationStatus = aiErr?.code === 'AI_BLOCKED_BY_POLICY' ? 'BLOCKED' : aiErr?.code === 'AI_OUTPUT_INVALID' ? 'INVALID_OUTPUT' : aiErr?.code === 'AI_REFUSED' ? 'REFUSED' : aiErr?.code === 'AI_TIMEOUT' ? 'TIMEOUT' : 'PROVIDER_ERROR';
      this.logger.warn({ draftId, code: aiErr?.code ?? 'UNKNOWN', message: (err as Error).message }, 'ai draft failed');
      const invocation = await this.prisma.aiInvocation.create({ data: { workflow: draft.workflow, provider: 'n/a', model: 'n/a', promptName: draft.promptName, promptVersion: draft.promptVersion, status, errorMessage: (err as Error).message.slice(0, 500) } }).catch(() => null);
      await this.prisma.aiDraft.update({ where: { id: draftId }, data: { status: 'FAILED', failureReason: `${aiErr?.code ?? 'ERROR'}: ${(err as Error).message}`.slice(0, 500), invocationId: invocation?.id } });
      await this.audit.log({ action: status === 'BLOCKED' ? 'AI_INVOCATION_BLOCKED' : 'AI_DRAFT_FAILED', resource: 'AiDraft', resourceId: draftId, patientId: ctx?.patientId, organizationId: ctx?.organizationId, actorId: null, actorRole: 'SYSTEM', metadata: { workflow: draft.workflow, code: aiErr?.code ?? 'UNKNOWN' } });
      if (!isAdvisoryWorkflow(draft.workflow as AiWorkflow)) {
        await this.notifications.notify({ userId: draft.requestedById, type: 'DRAFT_READY', title: 'AI draft could not be generated', body: `The ${draft.workflow.toLowerCase().replace(/_/g, ' ')} draft failed (${aiErr?.code ?? 'error'}). You can retry or proceed manually.`, data: { draftId, failed: true }, channels: ['IN_APP'] });
      }
    }
  }

  /** Workflow-specific side effects after a successful generation (stages 12–13). */
  private async postProcess(draft: AiDraft, ctx: { patientId: string; organizationId: string }, output: unknown): Promise<void> {
    switch (draft.workflow as AiWorkflow) {
      case 'MESSAGE_TRIAGE': {
        const o = output as MessageTriageOutput;
        const thread = await this.prisma.messageThread.findUnique({ where: { id: draft.threadId! } });
        if (!thread) return;
        const urgency = maxUrgency(thread.urgency, o.urgencyLevel);
        const escalate = urgencyAtLeast(urgency, 'HIGH');
        await this.prisma.messageThread.update({ where: { id: thread.id }, data: { intent: o.intent, suggestedRoute: o.suggestedRoute, urgency, status: escalate ? 'ESCALATED' : thread.status === 'TRIAGING' ? 'ROUTED' : thread.status } });
        if (escalate) {
          await this.escalations.raise({ organizationId: ctx.organizationId, patientId: ctx.patientId, threadId: thread.id, source: 'AI_OUTPUT', urgency, redFlags: o.redFlags, summary: o.summary });
        }
        return;
      }
      case 'INTAKE_SUMMARY': {
        const o = output as { urgencyLevel: UrgencyLevel; redFlags: string[]; summary: string };
        await this.prisma.intakeForm.update({ where: { id: draft.intakeFormId! }, data: { status: 'SUMMARIZED' } });
        if (urgencyAtLeast(o.urgencyLevel, 'HIGH')) {
          await this.escalations.raise({ organizationId: ctx.organizationId, patientId: ctx.patientId, source: 'AI_OUTPUT', urgency: o.urgencyLevel, redFlags: o.redFlags, summary: o.summary.slice(0, 1000) });
        }
        return;
      }
      case 'PATIENT_MESSAGE_DRAFT': {
        const o = output as PatientMessageDraftOutput;
        if (o.escalationRecommended && urgencyAtLeast(o.urgencyLevel, 'HIGH')) {
          await this.escalations.raise({ organizationId: ctx.organizationId, patientId: ctx.patientId, threadId: draft.threadId, source: 'AI_OUTPUT', urgency: o.urgencyLevel, redFlags: draft.safetyFlags, summary: o.escalationReason ?? 'AI recommended escalation' });
        }
        await this.prisma.messageThread.updateMany({ where: { id: draft.threadId!, status: { in: ['OPEN', 'TRIAGING', 'ROUTED'] } }, data: { status: 'AWAITING_REVIEW' } });
        break;
      }
      default:
        break;
    }
    await this.notifications.notify({ userId: draft.requestedById, type: 'DRAFT_READY', title: 'AI draft ready for review', body: `A ${draft.workflow.toLowerCase().replace(/_/g, ' ')} draft is waiting for your review.`, data: { draftId: draft.id, workflow: draft.workflow, encounterId: draft.encounterId, threadId: draft.threadId }, channels: ['IN_APP'] });
  }

  /* ------------------------------------------------------------------ */
  /* Reading                                                              */
  /* ------------------------------------------------------------------ */

  async get(user: RequestUser, id: string): Promise<AiDraftView> {
    const draft = await this.prisma.aiDraft.findUnique({ where: { id }, include: draftInclude });
    if (!draft) throw new NotFoundError('AI draft', id);
    await this.assertDraftAccess(user, draft);
    return draft;
  }

  async listForEncounter(user: RequestUser, encounterId: string): Promise<AiDraftView[]> {
    await this.access.assertEncounterAccess(user, encounterId);
    return this.prisma.aiDraft.findMany({ where: { encounterId }, include: draftInclude, orderBy: { createdAt: 'desc' } });
  }

  /** Human review queue (stage 13): pending drafts the caller is allowed to act on. */
  async reviewQueue(user: RequestUser, q: PaginationQuery & { workflow?: AiWorkflow }): Promise<Paginated<AiDraftView>> {
    if (user.role === 'PATIENT') throw new ForbiddenError();
    const policy = await this.aiConfig.forOrganization(user.organizationId);
    const workflows = (['CLINICAL_NOTE', 'PATIENT_MESSAGE_DRAFT', 'INTAKE_SUMMARY', 'PATIENT_EDUCATION'] as AiWorkflow[]).filter((w) => canReviewDraft(user.role, w, policy.requireClinicianApproval) && (!q.workflow || q.workflow === w));
    const scope = await this.access.patientScope(user);
    const patientFilter = scope === 'ALL' ? {} : scope.patientId ? { patientId: scope.patientId } : { patientId: { in: scope.patientIds ?? [] } };
    const where: Prisma.AiDraftWhereInput = {
      status: 'PENDING_REVIEW',
      workflow: { in: workflows },
      OR: [
        { encounter: { appointment: { organizationId: user.organizationId, ...patientFilter } } },
        { thread: { organizationId: user.organizationId, ...patientFilter } },
        { intakeForm: { appointment: { organizationId: user.organizationId }, ...patientFilter } },
      ],
    };
    const skip = (q.page - 1) * q.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.aiDraft.findMany({ where, include: draftInclude, orderBy: { createdAt: 'asc' }, skip, take: q.pageSize }),
      this.prisma.aiDraft.count({ where }),
    ]);
    return { items, page: q.page, pageSize: q.pageSize, total };
  }

  /* ------------------------------------------------------------------ */
  /* Review                                                               */
  /* ------------------------------------------------------------------ */

  async review(user: RequestUser, id: string, input: ReviewDraftInput): Promise<AiDraftView> {
    const draft = await this.get(user, id);
    if (draft.status !== 'PENDING_REVIEW') throw new InvalidStateTransitionError('AI draft', draft.status, 'review');
    const patientId = await this.patientIdOf(draft);
    const organizationId = user.organizationId;
    const policy = await this.aiConfig.forOrganization(organizationId);
    if (!canReviewDraft(user.role, draft.workflow as AiWorkflow, policy.requireClinicianApproval)) {
      throw new ForbiddenError(`Your role cannot approve ${draft.workflow} drafts under the current policy`);
    }
    if (input.decision === 'APPROVED_WITH_EDITS' && !input.editedOutput) throw new ValidationError('editedOutput is required for APPROVED_WITH_EDITS');
    // Approving a patient-facing draft the AI itself flagged for escalation requires an explicit comment.
    const aiEscalation = (draft.output as { escalationRecommended?: boolean } | null)?.escalationRecommended === true;
    if (input.decision !== 'REJECTED' && aiEscalation && !input.comments) throw new ValidationError('This draft was flagged for escalation; add a comment explaining the decision');

    const editDistance = input.editedOutput ? normalizedEditDistance(JSON.stringify(draft.output ?? {}), JSON.stringify(input.editedOutput)) : input.decision === 'APPROVED' ? 0 : null;
    const nextStatus = input.decision === 'REJECTED' ? 'REJECTED' : 'APPROVED';
    const approval = await this.prisma.$transaction(async (tx) => {
      const a = await tx.approval.create({ data: { aiDraftId: id, reviewerId: user.id, reviewerRole: user.role, decision: input.decision, comments: input.comments, editDistance } });
      await tx.aiDraft.update({ where: { id }, data: { status: nextStatus, editedOutput: input.editedOutput as Prisma.InputJsonValue | undefined, reviewedAt: new Date() } });
      return a;
    });
    if (input.editedOutput) await this.audit.log({ action: 'AI_DRAFT_EDITED', resource: 'AiDraft', resourceId: id, patientId, metadata: { editDistance } });
    await this.audit.log({ action: input.decision === 'REJECTED' ? 'AI_DRAFT_REJECTED' : 'AI_DRAFT_APPROVED', resource: 'AiDraft', resourceId: id, patientId, metadata: { decision: input.decision, workflow: draft.workflow, approvalId: approval.id, editDistance } });

    if (draft.workflow === 'PATIENT_MESSAGE_DRAFT' && draft.threadId) {
      await this.finishMessageDraftReview(user, draft, input, approval, patientId);
    }
    return this.prisma.aiDraft.findUniqueOrThrow({ where: { id }, include: draftInclude });
  }

  /** After a message-draft decision: send the reply (if approved) and reopen the thread for further AI drafts. */
  private async finishMessageDraftReview(user: RequestUser, draft: AiDraftView, input: ReviewDraftInput, approval: Approval, patientId: string | undefined): Promise<void> {
    const threadId = draft.threadId!;
    if (input.decision !== 'REJECTED' && input.sendOnApprove) {
      const output = (input.editedOutput ?? draft.output) as PatientMessageDraftOutput;
      const body = output?.suggestedResponse?.trim();
      if (!body) throw new ValidationError('Approved output has no suggestedResponse to send');
      await this.consents.assertGranted(patientId ?? '', 'MESSAGING');
      const thread = await this.prisma.messageThread.findUniqueOrThrow({ where: { id: threadId }, include: { patient: { select: { userId: true } } } });
      const msg = await this.prisma.$transaction(async (tx) => {
        const m = await tx.message.create({ data: { threadId, senderType: 'STAFF', senderId: user.id, body, aiDrafted: true, aiDraftId: draft.id } });
        await tx.messageThread.update({ where: { id: threadId }, data: { lastMessageAt: new Date(), status: thread.status === 'ESCALATED' ? 'ESCALATED' : 'ROUTED', assignedToUserId: thread.assignedToUserId ?? user.id } });
        return m;
      });
      await this.audit.log({ action: 'MESSAGE_SENT', resource: 'Message', resourceId: msg.id, patientId, metadata: { threadId, aiDrafted: true, aiDraftId: draft.id, approvalId: approval.id } });
      await this.notifications.notify({ userId: thread.patient.userId, type: 'MESSAGE_REPLY', title: 'New message from your care team', body: 'Your care team has replied to your message. Open the portal to read it.', data: { threadId } });
    } else {
      await this.prisma.messageThread.updateMany({ where: { id: threadId, status: 'AWAITING_REVIEW' }, data: { status: 'ROUTED' } });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                              */
  /* ------------------------------------------------------------------ */

  private async assertDraftAccess(user: RequestUser, draft: AiDraft): Promise<void> {
    if (user.role === 'PATIENT') throw new ForbiddenError('AI drafts are only visible to care staff');
    if (draft.encounterId) await this.access.assertEncounterAccess(user, draft.encounterId);
    else if (draft.threadId) await this.access.assertThreadAccess(user, draft.threadId);
    else if (draft.intakeFormId) {
      const form = await this.prisma.intakeForm.findUniqueOrThrow({ where: { id: draft.intakeFormId }, select: { appointmentId: true } });
      await this.access.assertAppointmentAccess(user, form.appointmentId);
    } else throw new ConflictError('Draft is not linked to any record');
  }

  private async patientIdOf(draft: AiDraft): Promise<string | undefined> {
    if (draft.threadId) return (await this.prisma.messageThread.findUnique({ where: { id: draft.threadId }, select: { patientId: true } }))?.patientId;
    if (draft.intakeFormId) return (await this.prisma.intakeForm.findUnique({ where: { id: draft.intakeFormId }, select: { patientId: true } }))?.patientId;
    if (draft.encounterId) return (await this.prisma.encounter.findUnique({ where: { id: draft.encounterId }, select: { appointment: { select: { patientId: true } } } }))?.appointment.patientId;
    return undefined;
  }
}

const ORDER: UrgencyLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];
function maxUrgency(a: UrgencyLevel, b: UrgencyLevel): UrgencyLevel {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}
