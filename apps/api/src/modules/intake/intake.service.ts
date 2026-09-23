import { detectRedFlags, urgencyAtLeast } from '@app/ai';
import type { IntakeForm, Prisma } from '@app/db';
import { FEATURE_FLAGS, type SubmitIntakeInput } from '@app/shared';
import { Injectable, Logger } from '@nestjs/common';

import { AccessPolicyService } from '../../access/access-policy.service';
import { InvalidStateTransitionError, NotFoundError } from '../../common/errors/app-error';
import { FeatureFlagsService } from '../../infra/feature-flags/feature-flags.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AiDraftsService } from '../ai/ai-drafts.service';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../auth/auth.types';
import { ConsentsService } from '../consents/consents.service';
import { EscalationsService } from '../escalations/escalations.service';

/**
 * Pre-visit intake (blueprint §4.2 step 1 → "AI intake summary").
 * Submission always runs deterministic red-flag rules; the AI summary is
 * queued only when the AI_PROCESSING consent is granted and AI notes are on.
 */
@Injectable()
export class IntakeService {
  private readonly logger = new Logger(IntakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
    private readonly audit: AuditService,
    private readonly consents: ConsentsService,
    private readonly flags: FeatureFlagsService,
    private readonly escalations: EscalationsService,
    private readonly drafts: AiDraftsService,
  ) {}

  async get(user: RequestUser, appointmentId: string): Promise<IntakeForm & { aiDrafts: unknown[] }> {
    await this.access.assertAppointmentAccess(user, appointmentId);
    const form = await this.prisma.intakeForm.findUnique({
      where: { appointmentId },
      include: { aiDrafts: { where: { workflow: 'INTAKE_SUMMARY', status: { in: ['PENDING_REVIEW', 'APPROVED'] } }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, output: true, editedOutput: true, safetyFlags: true, createdAt: true } } },
    });
    if (!form) throw new NotFoundError('Intake form');
    if (user.role === 'PATIENT') return { ...form, aiDrafts: [] }; // AI summary is for the clinician, not shown raw to patients
    return form;
  }

  async submit(user: RequestUser, appointmentId: string, input: SubmitIntakeInput): Promise<IntakeForm> {
    const appt = await this.access.assertAppointmentAccess(user, appointmentId);
    if (appt.status === 'CANCELLED' || appt.status === 'COMPLETED') throw new InvalidStateTransitionError('appointment', appt.status, 'submit intake for');
    const form = await this.prisma.intakeForm.findUnique({ where: { appointmentId } });
    if (!form) throw new NotFoundError('Intake form');
    if (form.status === 'REVIEWED') throw new InvalidStateTransitionError('intake', form.status, 'resubmit');

    // Stage: deterministic red-flag detection over every free-text answer.
    const text = collectText(input.answers);
    const report = detectRedFlags(text);
    const redFlags = [...new Set(report.flags.map((f) => f.category))];

    const updated = await this.prisma.intakeForm.update({
      where: { id: form.id },
      data: { answers: input.answers as Prisma.InputJsonValue, status: 'SUBMITTED', submittedAt: new Date(), redFlags, urgency: report.urgency },
    });
    await this.audit.log({ action: 'INTAKE_SUBMITTED', resource: 'IntakeForm', resourceId: form.id, patientId: form.patientId, metadata: { redFlags, urgency: report.urgency } });

    if (urgencyAtLeast(report.urgency, 'HIGH')) {
      await this.escalations.raise({
        organizationId: appt.organizationId,
        patientId: form.patientId,
        source: 'INTAKE',
        urgency: report.urgency,
        redFlags,
        summary: `Intake for appointment ${appointmentId} reported: ${redFlags.join(', ')}`,
      });
    }

    // Stage: queue AI intake summary (consent + feature gated; never blocks submission).
    const aiOn = await this.flags.isEnabled(FEATURE_FLAGS.AI_NOTES, appt.organizationId);
    if (aiOn && (await this.consents.isGranted(form.patientId, 'AI_PROCESSING'))) {
      await this.drafts.requestDraft({ requestedById: user.id, organizationId: appt.organizationId, patientId: form.patientId, workflow: 'INTAKE_SUMMARY', intakeFormId: form.id, systemRequested: true }).catch((err) => this.logger.warn({ err: (err as Error).message }, 'intake summary not queued'));
    }
    return updated;
  }
}

function collectText(value: unknown, acc: string[] = []): string {
  if (typeof value === 'string') acc.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectText(v, acc));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectText(v, acc));
  return acc.join('\n');
}
