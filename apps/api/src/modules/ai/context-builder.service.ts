import type { KnownPhiEntity } from '@app/ai';
import type { AiDraft } from '@app/db';
import type { AiWorkflow } from '@app/shared';
import { Injectable } from '@nestjs/common';

import { ValidationError } from '../../common/errors/app-error';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface BuiltContext {
  variables: Record<string, string>;
  /** Variables that carry patient-supplied text (sanitised + wrapped by the gateway). */
  untrustedVariables: string[];
  knownPhi: KnownPhiEntity[];
  patientId: string;
  organizationId: string;
}

export interface DraftOptions {
  template?: string;
  instructions?: string;
  topic?: string;
  language?: string;
}

/**
 * Stage 4 of the AI pipeline: assemble the *minimum necessary* context for a
 * workflow from authorised records only. Names and identifiers are passed as
 * `knownPhi` so the redactor removes them deterministically before any
 * external call; free-text from patients is flagged untrusted.
 */
@Injectable()
export class ContextBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  async build(draft: AiDraft, options: DraftOptions): Promise<BuiltContext> {
    switch (draft.workflow as AiWorkflow) {
      case 'CLINICAL_NOTE':
        return this.clinicalNote(draft, options);
      case 'INTAKE_SUMMARY':
        return this.intakeSummary(draft);
      case 'PATIENT_MESSAGE_DRAFT':
        return this.patientMessage(draft, options);
      case 'MESSAGE_TRIAGE':
        return this.messageTriage(draft);
      case 'PATIENT_EDUCATION':
        return this.patientEducation(draft, options);
    }
  }

  private async clinicalNote(draft: AiDraft, o: DraftOptions): Promise<BuiltContext> {
    if (!draft.encounterId) throw new ValidationError('CLINICAL_NOTE requires an encounter');
    const enc = await this.prisma.encounter.findUniqueOrThrow({
      where: { id: draft.encounterId },
      include: { clinician: { include: { user: true } }, appointment: { include: { patient: { include: { user: true } }, intakeForm: { include: { aiDrafts: { where: { workflow: 'INTAKE_SUMMARY', status: { in: ['PENDING_REVIEW', 'APPROVED'] } }, orderBy: { createdAt: 'desc' }, take: 1 } } } } } },
    });
    const patient = enc.appointment.patient;
    const intake = enc.appointment.intakeForm;
    const intakeSummary = intake?.aiDrafts[0]?.output as { summary?: string } | undefined;
    const context = [
      `Patient age: ${ageOf(patient.dateOfBirth)}`,
      `Appointment reason: ${enc.appointment.reason ?? '(not provided)'}`,
      `Chief complaint: ${enc.chiefComplaint ?? '(not provided)'}`,
      `Encounter date: ${(enc.startedAt ?? enc.createdAt).toISOString().slice(0, 10)}`,
      intake?.redFlags?.length ? `Rule-based red flags at intake: ${intake.redFlags.join(', ')}` : '',
    ].filter(Boolean).join('\n');
    return {
      variables: {
        context,
        clinicianNotes: enc.notes ?? '',
        patientInput: intakeSummary?.summary ?? (intake?.answers ? JSON.stringify(intake.answers, null, 1) : ''),
        template: o.template ?? 'SOAP',
        language: o.language ?? patient.preferredLang ?? 'en',
      },
      untrustedVariables: ['patientInput'],
      knownPhi: this.phiFor(patient.user, patient.mrn, enc.clinician?.user),
      patientId: patient.id,
      organizationId: enc.appointment.organizationId,
    };
  }

  private async intakeSummary(draft: AiDraft): Promise<BuiltContext> {
    if (!draft.intakeFormId) throw new ValidationError('INTAKE_SUMMARY requires an intake form');
    const form = await this.prisma.intakeForm.findUniqueOrThrow({ where: { id: draft.intakeFormId }, include: { appointment: true, patient: { include: { user: true } } } });
    return {
      variables: { appointmentReason: form.appointment.reason ?? '', intakeAnswers: form.answers ? JSON.stringify(form.answers, null, 1) : '' },
      untrustedVariables: ['intakeAnswers', 'appointmentReason'],
      knownPhi: this.phiFor(form.patient.user, form.patient.mrn),
      patientId: form.patientId,
      organizationId: form.appointment.organizationId,
    };
  }

  private async patientMessage(draft: AiDraft, o: DraftOptions): Promise<BuiltContext> {
    if (!draft.threadId) throw new ValidationError('PATIENT_MESSAGE_DRAFT requires a thread');
    const thread = await this.prisma.messageThread.findUniqueOrThrow({
      where: { id: draft.threadId },
      include: { patient: { include: { user: true, careTeam: { include: { clinician: { include: { user: true } } } }, appointments: { where: { scheduledAt: { gte: new Date() }, status: 'SCHEDULED' }, orderBy: { scheduledAt: 'asc' }, take: 1 } } }, messages: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    const msgs = [...thread.messages].reverse();
    const latestPatient = [...msgs].reverse().find((m) => m.senderType === 'PATIENT');
    const history = msgs.filter((m) => m.id !== latestPatient?.id).map((m) => `[${m.senderType}] ${m.body}`).join('\n');
    const next = thread.patient.appointments[0];
    const context = [
      `Patient preferred language: ${thread.patient.preferredLang}`,
      next ? `Next scheduled appointment: ${next.scheduledAt.toISOString()}` : 'No upcoming appointment scheduled',
      `Thread urgency (rule-based): ${thread.urgency}`,
      thread.intent ? `Detected intent: ${thread.intent}` : '',
    ].filter(Boolean).join('\n');
    return {
      variables: { patientMessage: latestPatient?.body ?? '', threadContext: history, context, instructions: o.instructions ?? '' },
      untrustedVariables: ['patientMessage', 'threadContext'],
      knownPhi: this.phiFor(thread.patient.user, thread.patient.mrn, ...thread.patient.careTeam.map((c) => c.clinician.user)),
      patientId: thread.patientId,
      organizationId: thread.organizationId,
    };
  }

  private async messageTriage(draft: AiDraft): Promise<BuiltContext> {
    if (!draft.threadId) throw new ValidationError('MESSAGE_TRIAGE requires a thread');
    const thread = await this.prisma.messageThread.findUniqueOrThrow({ where: { id: draft.threadId }, include: { patient: { include: { user: true } }, messages: { where: { senderType: 'PATIENT' }, orderBy: { createdAt: 'desc' }, take: 1 } } });
    return {
      variables: { patientMessage: thread.messages[0]?.body ?? '', subject: thread.subject ?? '' },
      untrustedVariables: ['patientMessage', 'subject'],
      knownPhi: this.phiFor(thread.patient.user, thread.patient.mrn),
      patientId: thread.patientId,
      organizationId: thread.organizationId,
    };
  }

  private async patientEducation(draft: AiDraft, o: DraftOptions): Promise<BuiltContext> {
    if (!o.topic) throw new ValidationError('PATIENT_EDUCATION requires options.topic');
    if (!draft.encounterId) throw new ValidationError('PATIENT_EDUCATION requires an encounter');
    const enc = await this.prisma.encounter.findUniqueOrThrow({ where: { id: draft.encounterId }, include: { appointment: { include: { patient: true } } } });
    return {
      variables: { topic: o.topic, instructions: o.instructions ?? '', language: o.language ?? enc.appointment.patient.preferredLang },
      untrustedVariables: [],
      knownPhi: [],
      patientId: enc.appointment.patientId,
      organizationId: enc.appointment.organizationId,
    };
  }

  private phiFor(patientUser: { firstName: string; lastName: string; email: string; phone: string | null }, mrn: string | null, ...staff: Array<{ firstName: string; lastName: string } | undefined>): KnownPhiEntity[] {
    const out: KnownPhiEntity[] = [
      { value: `${patientUser.firstName} ${patientUser.lastName}`, label: 'PATIENT_NAME' },
      { value: patientUser.lastName, label: 'PATIENT_NAME' },
      { value: patientUser.firstName, label: 'PATIENT_NAME' },
      { value: patientUser.email, label: 'EMAIL' },
    ];
    if (patientUser.phone) out.push({ value: patientUser.phone, label: 'PHONE' });
    if (mrn) out.push({ value: mrn, label: 'MRN' });
    for (const s of staff) if (s) out.push({ value: `${s.firstName} ${s.lastName}`, label: 'CLINICIAN_NAME' });
    return out;
  }
}

function ageOf(dob: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  if (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate())) age--;
  return age;
}
