/* eslint-disable no-console */
/**
 * Development seed. Creates one organisation with a full set of role
 * accounts and a sample patient journey (appointment + intake + consents).
 * Prompt templates are seeded by the API on boot (PromptRegistryService).
 *
 * All passwords: `ClinicalAi!2026dev` — dev only, never reuse.
 */
import { PrismaClient, UserRole, ConsentType, ConsentStatus, AppointmentStatus } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();
const DEV_PASSWORD = 'ClinicalAi!2026dev';

async function main() {
  const passwordHash = await argon2.hash(DEV_PASSWORD, { type: argon2.argon2id });

  const org = await prisma.organization.upsert({
    where: { slug: 'demo-clinic' },
    update: {},
    create: {
      name: 'Demo Family Clinic',
      slug: 'demo-clinic',
      timeZone: 'Europe/London',
      emergencyGuidanceText:
        'If you think this is an emergency, call 999 (UK) or your local emergency number now. Messages here are not monitored 24/7.',
    },
  });

  const mkUser = (email: string, role: UserRole, firstName: string, lastName: string) =>
    prisma.user.upsert({
      where: { email },
      update: {},
      create: { organizationId: org.id, email, role, firstName, lastName, passwordHash },
    });

  const admin = await mkUser('admin@demo-clinic.test', 'ADMIN', 'Ada', 'Admin');
  const compliance = await mkUser('compliance@demo-clinic.test', 'COMPLIANCE', 'Cora', 'Compliance');
  const frontDesk = await mkUser('frontdesk@demo-clinic.test', 'FRONT_DESK', 'Frank', 'Desk');
  const nurseUser = await mkUser('nurse@demo-clinic.test', 'NURSE', 'Nina', 'Nurse');
  const drUser = await mkUser('dr.smith@demo-clinic.test', 'CLINICIAN', 'Sarah', 'Smith');
  const patientUser = await mkUser('patient@demo-clinic.test', 'PATIENT', 'Peter', 'Patient');

  const clinician = await prisma.clinician.upsert({
    where: { userId: drUser.id },
    update: {},
    create: { userId: drUser.id, organizationId: org.id, specialty: 'General Practice', licenseInfo: 'GMC 1234567' },
  });

  const patient = await prisma.patient.upsert({
    where: { userId: patientUser.id },
    update: {},
    create: {
      userId: patientUser.id,
      organizationId: org.id,
      mrn: 'MRN-0001',
      dateOfBirth: new Date('1984-03-14'),
      preferredLang: 'en',
      timeZone: 'Europe/London',
    },
  });

  await prisma.careTeamAssignment.upsert({
    where: { patientId_clinicianId: { patientId: patient.id, clinicianId: clinician.id } },
    update: {},
    create: { patientId: patient.id, clinicianId: clinician.id, role: 'PRIMARY' },
  });

  for (const type of ['TREATMENT', 'DATA_PROCESSING', 'AI_PROCESSING', 'MESSAGING'] as ConsentType[]) {
    const existing = await prisma.consent.findFirst({ where: { patientId: patient.id, type } });
    if (!existing) {
      await prisma.consent.create({
        data: { patientId: patient.id, type, status: ConsentStatus.GRANTED, version: '1.0', grantedAt: new Date() },
      });
    }
  }

  const scheduledAt = new Date();
  scheduledAt.setDate(scheduledAt.getDate() + 1);
  scheduledAt.setHours(10, 0, 0, 0);

  const existingAppt = await prisma.appointment.findFirst({ where: { patientId: patient.id } });
  const appointment =
    existingAppt ??
    (await prisma.appointment.create({
      data: {
        organizationId: org.id,
        patientId: patient.id,
        clinicianId: clinician.id,
        scheduledAt,
        status: AppointmentStatus.SCHEDULED,
        reason: 'Persistent cough for two weeks',
        createdById: frontDesk.id,
        intakeForm: { create: { patientId: patient.id } },
      },
    }));

  await prisma.featureFlag.upsert({
    where: { key_organizationId: { key: 'FEATURE_AI_NOTES', organizationId: org.id } },
    update: {},
    create: { key: 'FEATURE_AI_NOTES', organizationId: org.id, enabled: true },
  });

  console.log('Seeded organisation', org.slug);
  console.table(
    [admin, compliance, frontDesk, nurseUser, drUser, patientUser].map((u) => ({ email: u.email, role: u.role })),
  );
  console.log('Appointment', appointment.id, 'for patient', patient.id);
  console.log('Dev password for all users:', DEV_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
