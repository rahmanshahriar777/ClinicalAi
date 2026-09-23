import { z } from 'zod';

import { USER_ROLES } from '../constants';

export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128)
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[0-9]/, 'Must contain a digit');

export const loginSchema = z.object({
  email: z.string().email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(512) });
export type RefreshInput = z.infer<typeof refreshSchema>;

export const mfaVerifySchema = z.object({
  mfaToken: z.string().min(20),
  code: z.string().regex(/^\d{6}$/, '6-digit code required'),
});
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;

export const mfaConfirmSchema = z.object({ code: z.string().regex(/^\d{6}$/) });

export const registerPatientSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email().max(254).transform((v) => v.toLowerCase()),
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  dateOfBirth: z.coerce.date().max(new Date(), 'Date of birth must be in the past'),
  preferredLang: z.string().min(2).max(10).default('en'),
  timeZone: z.string().max(64).default('UTC'),
  phone: z.string().max(32).optional(),
});
export type RegisterPatientInput = z.infer<typeof registerPatientSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
  tokenType: z.literal('Bearer'),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const authUserSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(USER_ROLES),
  firstName: z.string(),
  lastName: z.string(),
  patientId: z.string().uuid().nullable().optional(),
  clinicianId: z.string().uuid().nullable().optional(),
  mfaEnabled: z.boolean().optional(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const loginResponseSchema = z.union([
  z.object({ mfaRequired: z.literal(true), mfaToken: z.string() }),
  z.object({ mfaRequired: z.literal(false).optional(), user: authUserSchema, tokens: authTokensSchema }),
]);
export type LoginResponse = z.infer<typeof loginResponseSchema>;
