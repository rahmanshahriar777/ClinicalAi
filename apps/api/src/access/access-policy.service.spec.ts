import { permissionsForRole } from '@app/shared';

import { ForbiddenError, NotFoundError } from '../common/errors/app-error';
import type { RequestUser } from '../modules/auth/auth.types';

import { AccessPolicyService } from './access-policy.service';

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const P1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const P2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function user(role: RequestUser['role'], extra: Partial<RequestUser> = {}): RequestUser {
  return { id: `user-${role}`, organizationId: ORG, email: `${role}@x`, role, firstName: 'A', lastName: 'B', patientId: null, clinicianId: null, permissions: permissionsForRole(role), mfaEnabled: false, ...extra };
}

function prismaMock(overrides: Record<string, unknown> = {}) {
  return {
    patient: { findUnique: jest.fn(async ({ where }: { where: { id: string } }) => (where.id === P1 || where.id === P2 ? { id: where.id, organizationId: ORG } : null)) },
    appointment: { findUnique: jest.fn(), findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    encounter: { findUnique: jest.fn() },
    messageThread: { findUnique: jest.fn() },
    careTeamAssignment: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    ...overrides,
  } as never;
}

describe('AccessPolicyService (blueprint §11.2 row-level authorisation)', () => {
  it('patients can only access their own record', async () => {
    const svc = new AccessPolicyService(prismaMock());
    await expect(svc.assertPatientAccess(user('PATIENT', { patientId: P1 }), P1)).resolves.toMatchObject({ id: P1 });
    await expect(svc.assertPatientAccess(user('PATIENT', { patientId: P1 }), P2)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('cross-organisation access is reported as not found (no existence leak)', async () => {
    const prisma = prismaMock({ patient: { findUnique: jest.fn(async () => ({ id: P1, organizationId: OTHER_ORG })) } });
    const svc = new AccessPolicyService(prisma);
    await expect(svc.assertPatientAccess(user('NURSE'), P1)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('clinicians need a care-team link or an assigned appointment', async () => {
    const prisma = prismaMock();
    const svc = new AccessPolicyService(prisma);
    const clin = user('CLINICIAN', { clinicianId: 'clin-1' });
    await expect(svc.assertPatientAccess(clin, P1)).rejects.toBeInstanceOf(ForbiddenError);

    (prisma as { careTeamAssignment: { findUnique: jest.Mock } }).careTeamAssignment.findUnique.mockResolvedValueOnce({ id: 'ct' });
    await expect(svc.assertPatientAccess(clin, P1)).resolves.toMatchObject({ id: P1 });

    (prisma as { appointment: { findFirst: jest.Mock } }).appointment.findFirst.mockResolvedValueOnce({ id: 'appt' });
    await expect(svc.assertPatientAccess(clin, P2)).resolves.toMatchObject({ id: P2 });
  });

  it('nurses and front desk see any patient in their organisation; compliance cannot (no patient:read:any)', async () => {
    const svc = new AccessPolicyService(prismaMock());
    await expect(svc.assertPatientAccess(user('NURSE'), P1)).resolves.toBeDefined();
    await expect(svc.assertPatientAccess(user('FRONT_DESK'), P2)).resolves.toBeDefined();
    await expect(svc.assertPatientAccess(user('COMPLIANCE'), P1)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('patientScope narrows list queries per role', async () => {
    const prisma = prismaMock({
      careTeamAssignment: { findUnique: jest.fn(), findMany: jest.fn(async () => [{ patientId: P1 }]) },
      appointment: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(async () => [{ patientId: P2 }, { patientId: P1 }]) },
    });
    const svc = new AccessPolicyService(prisma);
    expect(await svc.patientScope(user('PATIENT', { patientId: P1 }))).toEqual({ patientId: P1 });
    expect(await svc.patientScope(user('CLINICIAN', { clinicianId: 'c' }))).toEqual({ patientIds: [P1, P2] });
    expect(await svc.patientScope(user('ADMIN'))).toBe('ALL');
  });
});
