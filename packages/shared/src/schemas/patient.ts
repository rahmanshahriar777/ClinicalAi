import { z } from 'zod';

import { CONSENT_STATUSES, CONSENT_TYPES } from '../constants';

export const updatePatientProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    preferredLang: z.string().min(2).max(10),
    timeZone: z.string().max(64),
    phone: z.string().max(32).nullable(),
    notificationPreferences: z
      .object({
        inApp: z.boolean(),
        push: z.boolean(),
        email: z.boolean(),
        sms: z.boolean(),
      })
      .partial(),
  })
  .partial();
export type UpdatePatientProfileInput = z.infer<typeof updatePatientProfileSchema>;

export const recordConsentSchema = z.object({
  type: z.enum(CONSENT_TYPES),
  status: z.enum(['GRANTED', 'DECLINED', 'REVOKED']),
  version: z.string().min(1).max(32),
});
export type RecordConsentInput = z.infer<typeof recordConsentSchema>;

export const consentSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  type: z.enum(CONSENT_TYPES),
  status: z.enum(CONSENT_STATUSES),
  version: z.string(),
  grantedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type ConsentDto = z.infer<typeof consentSchema>;
