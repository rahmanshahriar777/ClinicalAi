import type { Encounter, Prisma } from '@app/db';
import type { UpdateEncounterInput } from '@app/shared';
import { Injectable } from '@nestjs/common';

import { AccessPolicyService } from '../../access/access-policy.service';
import { ForbiddenError, InvalidStateTransitionError } from '../../common/errors/app-error';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';

const include = {
  appointment: { include: { patient: { select: { id: true, dateOfBirth: true, preferredLang: true, user: { select: { firstName: true, lastName: true } } } }, intakeForm: { select: { id: true, status: true, urgency: true, redFlags: true, answers: true } } } },
  clinician: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
  documents: { orderBy: { createdAt: 'desc' }, select: { id: true, type: true, status: true, sharedWithPatientAt: true, createdAt: true, updatedAt: true } },
  aiDrafts: { orderBy: { createdAt: 'desc' }, select: { id: true, workflow: true, status: true, confidence: true, safetyFlags: true, createdAt: true } },
} satisfies Prisma.EncounterInclude;

export type EncounterView = Prisma.EncounterGetPayload<{ include: typeof include }>;

/**
 * Encounters (blueprint §4.2 steps 3–7). One encounter per appointment.
 * Patients get a reduced view (no clinician shorthand notes, no AI drafts).
 */
@Injectable()
export class EncountersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async createForAppointment(user: RequestUser, appointmentId: string): Promise<EncounterView> {
    if (user.role !== 'CLINICIAN') throw new ForbiddenError('Only clinicians can open encounters');
    const appt = await this.access.assertAppointmentAccess(user, appointmentId);
    if (appt.status === 'CANCELLED' || appt.status === 'NO_SHOW' || appt.status === 'COMPLETED') throw new InvalidStateTransitionError('appointment', appt.status, 'open an encounter for');
    const existing = await this.prisma.encounter.findUnique({ where: { appointmentId }, include });
    if (existing) return existing;
    const enc = await this.prisma.encounter.create({ data: { appointmentId, clinicianId: user.clinicianId, chiefComplaint: appt.reason }, include });
    return enc;
  }

  async get(user: RequestUser, id: string): Promise<EncounterView | Omit<EncounterView, 'notes' | 'aiDrafts'>> {
    await this.access.assertEncounterAccess(user, id);
    const enc = await this.prisma.encounter.findUniqueOrThrow({ where: { id }, include });
    if (user.role !== 'PATIENT') {
      await this.audit.log({ action: 'PHI_ACCESSED', resource: 'Encounter', resourceId: id, patientId: enc.appointment.patientId });
      return enc;
    }
    const { notes: _n, aiDrafts: _a, ...patientView } = enc;
    return { ...patientView, documents: enc.documents.filter((d) => d.sharedWithPatientAt) };
  }

  async start(user: RequestUser, id: string, chiefComplaint?: string): Promise<Encounter> {
    const enc = await this.assertClinician(user, id);
    if (enc.startedAt) throw new InvalidStateTransitionError('encounter', 'started', 'start');
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.encounter.update({ where: { id }, data: { startedAt: new Date(), clinicianId: enc.clinicianId ?? user.clinicianId, chiefComplaint: chiefComplaint ?? enc.chiefComplaint } });
      await tx.appointment.update({ where: { id: enc.appointmentId }, data: { status: 'IN_PROGRESS' } });
      return u;
    });
    await this.audit.log({ action: 'ENCOUNTER_STARTED', resource: 'Encounter', resourceId: id, patientId: enc.appointment.patientId });
    return updated;
  }

  async update(user: RequestUser, id: string, input: UpdateEncounterInput): Promise<Encounter> {
    const enc = await this.assertClinician(user, id);
    if (enc.endedAt) throw new InvalidStateTransitionError('encounter', 'completed', 'edit');
    return this.prisma.encounter.update({ where: { id }, data: input });
  }

  async complete(user: RequestUser, id: string, sendAfterVisitSummary: boolean): Promise<Encounter> {
    const enc = await this.assertClinician(user, id);
    if (enc.endedAt) throw new InvalidStateTransitionError('encounter', 'completed', 'complete');
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.encounter.update({ where: { id }, data: { endedAt: new Date(), startedAt: enc.startedAt ?? new Date() } });
      await tx.appointment.update({ where: { id: enc.appointmentId }, data: { status: 'COMPLETED' } });
      await tx.intakeForm.updateMany({ where: { appointmentId: enc.appointmentId, status: { in: ['SUBMITTED', 'SUMMARIZED'] } }, data: { status: 'REVIEWED', reviewedAt: new Date() } });
      return u;
    });
    await this.audit.log({ action: 'ENCOUNTER_COMPLETED', resource: 'Encounter', resourceId: id, patientId: enc.appointment.patientId });

    // Step 7: after-visit summary to the patient — only approved/signed documents are ever shared.
    if (sendAfterVisitSummary) {
      const avs = await this.prisma.clinicalDocument.findFirst({ where: { encounterId: id, type: 'AFTER_VISIT_SUMMARY', status: { in: ['APPROVED', 'SIGNED', 'AMENDED'] } }, orderBy: { createdAt: 'desc' } });
      if (avs) {
        await this.prisma.clinicalDocument.update({ where: { id: avs.id }, data: { sharedWithPatientAt: avs.sharedWithPatientAt ?? new Date() } });
        await this.notifications.notify({ userId: enc.appointment.patient.userId, type: 'DOCUMENT_AVAILABLE', title: 'Your after-visit summary is ready', body: 'Your care team has shared a summary of your visit. Open the portal to read it.', data: { documentId: avs.id, encounterId: id } });
      }
    }
    return updated;
  }

  private async assertClinician(user: RequestUser, id: string) {
    if (user.role !== 'CLINICIAN') throw new ForbiddenError('Only clinicians can modify encounters');
    return this.access.assertEncounterAccess(user, id);
  }
}
