import type { Appointment, Encounter, MessageThread, Patient } from '@app/db';
import { Injectable } from '@nestjs/common';

import { ForbiddenError, NotFoundError } from '../common/errors/app-error';
import { PrismaService } from '../infra/prisma/prisma.service';
import type { RequestUser } from '../modules/auth/auth.types';

/**
 * Row-level authorisation (blueprint §11.2 "patients see only their own data;
 * clinicians only patients under their care"). Applied on top of the
 * permission guard for every request that touches a specific record.
 *
 * Scope rules:
 *   PATIENT     → only records whose patientId is their own
 *   CLINICIAN   → patients on their care team, or with an appointment/encounter
 *                 assigned to them, within the same organisation
 *   NURSE/FRONT_DESK/ADMIN/COMPLIANCE → any patient in the same organisation
 *                 (their permissions decide what they can do with it)
 * Cross-organisation access is never allowed.
 */
@Injectable()
export class AccessPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async assertPatientAccess(user: RequestUser, patientId: string): Promise<Patient> {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient || patient.organizationId !== user.organizationId) throw new NotFoundError('Patient', patientId);
    if (user.role === 'PATIENT') {
      if (user.patientId !== patientId) throw new ForbiddenError();
      return patient;
    }
    if (user.role === 'CLINICIAN') {
      if (!(await this.clinicianHasPatient(user, patientId))) throw new ForbiddenError('Patient is not under your care');
      return patient;
    }
    if (!user.permissions.includes('patient:read:any')) throw new ForbiddenError();
    return patient;
  }

  async assertAppointmentAccess(user: RequestUser, appointmentId: string): Promise<Appointment & { patient: Patient }> {
    const appt = await this.prisma.appointment.findUnique({ where: { id: appointmentId }, include: { patient: true } });
    if (!appt || appt.organizationId !== user.organizationId) throw new NotFoundError('Appointment', appointmentId);
    if (user.role === 'PATIENT') {
      if (appt.patientId !== user.patientId) throw new ForbiddenError();
      return appt;
    }
    if (user.role === 'CLINICIAN') {
      const own = appt.clinicianId && appt.clinicianId === user.clinicianId;
      if (!own && !(await this.clinicianHasPatient(user, appt.patientId))) throw new ForbiddenError('Appointment is not assigned to you');
      return appt;
    }
    return appt;
  }

  async assertEncounterAccess(user: RequestUser, encounterId: string): Promise<Encounter & { appointment: Appointment & { patient: Patient } }> {
    const enc = await this.prisma.encounter.findUnique({ where: { id: encounterId }, include: { appointment: { include: { patient: true } } } });
    if (!enc || enc.appointment.organizationId !== user.organizationId) throw new NotFoundError('Encounter', encounterId);
    if (user.role === 'PATIENT') {
      if (enc.appointment.patientId !== user.patientId) throw new ForbiddenError();
      return enc;
    }
    if (user.role === 'CLINICIAN') {
      const own = (enc.clinicianId && enc.clinicianId === user.clinicianId) || (enc.appointment.clinicianId && enc.appointment.clinicianId === user.clinicianId);
      if (!own && !(await this.clinicianHasPatient(user, enc.appointment.patientId))) throw new ForbiddenError('Encounter is not assigned to you');
      return enc;
    }
    return enc;
  }

  async assertThreadAccess(user: RequestUser, threadId: string): Promise<MessageThread & { patient: Patient }> {
    const thread = await this.prisma.messageThread.findUnique({ where: { id: threadId }, include: { patient: true } });
    if (!thread || thread.organizationId !== user.organizationId) throw new NotFoundError('Thread', threadId);
    if (user.role === 'PATIENT') {
      if (thread.patientId !== user.patientId) throw new ForbiddenError();
      return thread;
    }
    if (user.role === 'CLINICIAN') {
      const assigned = thread.assignedToUserId === user.id;
      if (!assigned && !(await this.clinicianHasPatient(user, thread.patientId))) throw new ForbiddenError('Thread is not assigned to you');
      return thread;
    }
    return thread;
  }

  /** Care-team membership or any appointment assigned to this clinician. */
  async clinicianHasPatient(user: RequestUser, patientId: string): Promise<boolean> {
    if (!user.clinicianId) return false;
    const [care, appt] = await Promise.all([
      this.prisma.careTeamAssignment.findUnique({ where: { patientId_clinicianId: { patientId, clinicianId: user.clinicianId } }, select: { id: true } }),
      this.prisma.appointment.findFirst({ where: { patientId, clinicianId: user.clinicianId }, select: { id: true } }),
    ]);
    return Boolean(care || appt);
  }

  /** Prisma `where` fragment that limits a patient-scoped list to what the user may see. */
  async patientScope(user: RequestUser): Promise<{ patientId?: string; patientIds?: string[] } | 'ALL'> {
    if (user.role === 'PATIENT') return { patientId: user.patientId ?? '' };
    if (user.role === 'CLINICIAN') {
      const [care, appts] = await Promise.all([
        this.prisma.careTeamAssignment.findMany({ where: { clinicianId: user.clinicianId ?? '' }, select: { patientId: true } }),
        this.prisma.appointment.findMany({ where: { clinicianId: user.clinicianId ?? '' }, select: { patientId: true }, distinct: ['patientId'] }),
      ]);
      return { patientIds: [...new Set([...care.map((c) => c.patientId), ...appts.map((a) => a.patientId)])] };
    }
    return 'ALL';
  }
}
