import type { Appointment, Prisma } from '@app/db';
import type { CreateAppointmentInput, ListAppointmentsQuery, Paginated } from '@app/shared';
import { Injectable } from '@nestjs/common';

import { AccessPolicyService } from '../../access/access-policy.service';
import { ForbiddenError, InvalidStateTransitionError, NotFoundError, ValidationError } from '../../common/errors/app-error';
import { paginate, toSkipTake } from '../../common/utils/pagination';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';

const include = {
  patient: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
  clinician: { select: { id: true, specialty: true, user: { select: { firstName: true, lastName: true } } } },
  encounter: { select: { id: true, startedAt: true, endedAt: true } },
  intakeForm: { select: { id: true, status: true, urgency: true, submittedAt: true } },
} satisfies Prisma.AppointmentInclude;

export type AppointmentView = Prisma.AppointmentGetPayload<{ include: typeof include }>;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: RequestUser, q: ListAppointmentsQuery): Promise<Paginated<AppointmentView>> {
    const scope = await this.access.patientScope(user);
    const where: Prisma.AppointmentWhereInput = {
      organizationId: user.organizationId,
      ...(scope === 'ALL' ? {} : scope.patientId ? { patientId: scope.patientId } : { patientId: { in: scope.patientIds ?? [] } }),
      ...(q.patientId ? { patientId: q.patientId } : {}),
      ...(q.clinicianId ? { clinicianId: q.clinicianId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.from || q.to ? { scheduledAt: { gte: q.from, lte: q.to } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({ where, include, orderBy: { scheduledAt: 'asc' }, ...toSkipTake(q) }),
      this.prisma.appointment.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async get(user: RequestUser, id: string): Promise<AppointmentView> {
    await this.access.assertAppointmentAccess(user, id);
    const appt = await this.prisma.appointment.findUniqueOrThrow({ where: { id }, include });
    if (user.role !== 'PATIENT') await this.audit.log({ action: 'PHI_ACCESSED', resource: 'Appointment', resourceId: id, patientId: appt.patientId });
    return appt;
  }

  async create(user: RequestUser, input: CreateAppointmentInput): Promise<AppointmentView> {
    const patientId = user.role === 'PATIENT' ? user.patientId : input.patientId;
    if (!patientId) throw new ValidationError('patientId is required');
    const patient = await this.access.assertPatientAccess(user, patientId);
    if (input.scheduledAt < new Date()) throw new ValidationError('scheduledAt must be in the future');

    if (input.clinicianId) {
      const clinician = await this.prisma.clinician.findUnique({ where: { id: input.clinicianId } });
      if (!clinician || clinician.organizationId !== user.organizationId) throw new ValidationError('Unknown clinician');
      const end = new Date(input.scheduledAt.getTime() + input.durationMinutes * 60_000);
      const clash = await this.prisma.appointment.findFirst({
        where: { clinicianId: input.clinicianId, status: { in: ['SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS'] }, scheduledAt: { lt: end, gte: new Date(input.scheduledAt.getTime() - 4 * 3_600_000) } },
      });
      if (clash && new Date(clash.scheduledAt.getTime() + clash.durationMinutes * 60_000) > input.scheduledAt) {
        throw new ValidationError('Clinician is not available at that time');
      }
    }

    const appt = await this.prisma.appointment.create({
      data: { organizationId: patient.organizationId, patientId, clinicianId: input.clinicianId, scheduledAt: input.scheduledAt, durationMinutes: input.durationMinutes, reason: input.reason, createdById: user.id, intakeForm: { create: { patientId } } },
      include,
    });
    await this.audit.log({ action: 'APPOINTMENT_CREATED', resource: 'Appointment', resourceId: appt.id, patientId, metadata: { scheduledAt: appt.scheduledAt, clinicianId: appt.clinicianId } });
    await this.notifications.notify({
      userId: patient.userId,
      type: 'INTAKE_REMINDER',
      title: 'Appointment booked',
      body: `Your appointment is scheduled for ${appt.scheduledAt.toISOString()}. Please complete your pre-visit intake form.`,
      data: { appointmentId: appt.id },
    });
    return appt;
  }

  async cancel(user: RequestUser, id: string, reason?: string): Promise<AppointmentView> {
    const appt = await this.access.assertAppointmentAccess(user, id);
    if (appt.status === 'COMPLETED' || appt.status === 'CANCELLED' || appt.status === 'IN_PROGRESS') throw new InvalidStateTransitionError('appointment', appt.status, 'cancel');
    const updated = await this.prisma.appointment.update({ where: { id }, data: { status: 'CANCELLED', cancelReason: reason }, include });
    await this.audit.log({ action: 'APPOINTMENT_CANCELLED', resource: 'Appointment', resourceId: id, patientId: appt.patientId, metadata: { by: user.role } });
    if (user.role !== 'PATIENT') {
      await this.notifications.notify({ userId: appt.patient.userId, type: 'SYSTEM', title: 'Appointment cancelled', body: 'Your appointment has been cancelled by the clinic. Please contact us to rebook.', data: { appointmentId: id } });
    }
    return updated;
  }

  async checkIn(user: RequestUser, id: string): Promise<AppointmentView> {
    if (user.role === 'PATIENT') throw new ForbiddenError();
    const appt = await this.access.assertAppointmentAccess(user, id);
    if (appt.status !== 'SCHEDULED') throw new InvalidStateTransitionError('appointment', appt.status, 'check in');
    return this.prisma.appointment.update({ where: { id }, data: { status: 'CHECKED_IN' }, include });
  }

  async markNoShow(user: RequestUser, id: string): Promise<Appointment> {
    if (user.role === 'PATIENT') throw new ForbiddenError();
    const appt = await this.access.assertAppointmentAccess(user, id);
    if (appt.status !== 'SCHEDULED' && appt.status !== 'CHECKED_IN') throw new InvalidStateTransitionError('appointment', appt.status, 'mark no-show');
    return this.prisma.appointment.update({ where: { id }, data: { status: 'NO_SHOW' } });
  }

  async requireEncounterId(user: RequestUser, appointmentId: string): Promise<string> {
    const appt = await this.access.assertAppointmentAccess(user, appointmentId);
    const enc = await this.prisma.encounter.findUnique({ where: { appointmentId: appt.id }, select: { id: true } });
    if (!enc) throw new NotFoundError('Encounter for appointment', appointmentId);
    return enc.id;
  }
}
