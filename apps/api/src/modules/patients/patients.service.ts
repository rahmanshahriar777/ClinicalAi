import type { Prisma } from '@app/db';
import type { Paginated, PaginationQuery, UpdatePatientProfileInput } from '@app/shared';
import { Injectable } from '@nestjs/common';

import { AccessPolicyService } from '../../access/access-policy.service';
import { NotFoundError } from '../../common/errors/app-error';
import { paginate, toSkipTake } from '../../common/utils/pagination';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestUser } from '../auth/auth.types';

const patientSelect = {
  id: true,
  organizationId: true,
  mrn: true,
  dateOfBirth: true,
  preferredLang: true,
  timeZone: true,
  notifyInApp: true,
  notifyPush: true,
  notifyEmail: true,
  notifySms: true,
  createdAt: true,
  user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, isActive: true } },
  careTeam: { select: { role: true, clinician: { select: { id: true, specialty: true, user: { select: { firstName: true, lastName: true } } } } } },
} satisfies Prisma.PatientSelect;

export type PatientView = Prisma.PatientGetPayload<{ select: typeof patientSelect }>;

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
    private readonly audit: AuditService,
  ) {}

  async getMe(user: RequestUser): Promise<PatientView> {
    if (!user.patientId) throw new NotFoundError('Patient profile');
    return this.prisma.patient.findUniqueOrThrow({ where: { id: user.patientId }, select: patientSelect });
  }

  async getById(user: RequestUser, patientId: string): Promise<PatientView> {
    await this.access.assertPatientAccess(user, patientId);
    const patient = await this.prisma.patient.findUniqueOrThrow({ where: { id: patientId }, select: patientSelect });
    if (user.role !== 'PATIENT') await this.audit.log({ action: 'PHI_ACCESSED', resource: 'Patient', resourceId: patientId, patientId });
    return patient;
  }

  async list(user: RequestUser, q: PaginationQuery & { search?: string }): Promise<Paginated<PatientView>> {
    const scope = await this.access.patientScope(user);
    const where: Prisma.PatientWhereInput = {
      organizationId: user.organizationId,
      ...(scope !== 'ALL' ? { id: scope.patientId ? scope.patientId : { in: scope.patientIds ?? [] } } : {}),
      ...(q.search
        ? { user: { OR: [{ firstName: { contains: q.search, mode: 'insensitive' } }, { lastName: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }] } }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({ where, select: patientSelect, orderBy: { user: { lastName: 'asc' } }, ...toSkipTake(q) }),
      this.prisma.patient.count({ where }),
    ]);
    return paginate(items, total, q);
  }

  async update(user: RequestUser, patientId: string, input: UpdatePatientProfileInput): Promise<PatientView> {
    await this.access.assertPatientAccess(user, patientId);
    const { notificationPreferences: np, firstName, lastName, phone, ...rest } = input;
    await this.prisma.patient.update({
      where: { id: patientId },
      data: {
        ...rest,
        ...(np?.inApp !== undefined ? { notifyInApp: np.inApp } : {}),
        ...(np?.push !== undefined ? { notifyPush: np.push } : {}),
        ...(np?.email !== undefined ? { notifyEmail: np.email } : {}),
        ...(np?.sms !== undefined ? { notifySms: np.sms } : {}),
        ...(firstName !== undefined || lastName !== undefined || phone !== undefined ? { user: { update: { firstName, lastName, phone } } } : {}),
      },
    });
    await this.audit.log({ action: 'PATIENT_UPDATED', resource: 'Patient', resourceId: patientId, patientId, metadata: { fields: Object.keys(input) } });
    return this.prisma.patient.findUniqueOrThrow({ where: { id: patientId }, select: patientSelect });
  }
}
