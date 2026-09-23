import { z } from 'zod';

import { AI_WORKFLOWS, USER_ROLES } from '../constants';

import { passwordSchema } from './auth';
import { boundedText, paginationQuerySchema } from './common';

export const createUserSchema = z.object({
  organizationId: z.string().uuid().optional(),
  email: z.string().email().max(254).transform((v) => v.toLowerCase()),
  role: z.enum(USER_ROLES),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  /** Local auth mode only. In OIDC mode users authenticate with the IdP. */
  password: passwordSchema.optional(),
  /** External IdP subject (OIDC mode). */
  externalId: z.string().max(255).optional(),
  clinician: z.object({ specialty: z.string().max(100).optional(), licenseInfo: z.string().max(200).optional() }).optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    role: z.enum(USER_ROLES),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    isActive: z.boolean(),
  })
  .partial();

export const listUsersQuerySchema = paginationQuerySchema.extend({
  role: z.enum(USER_ROLES).optional(),
  search: z.string().max(100).optional(),
  organizationId: z.string().uuid().optional(),
});

export const createOrganizationSchema = z.object({
  name: boundedText(120),
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
  timeZone: z.string().max(64).default('UTC'),
  emergencyGuidanceText: z.string().max(2000).optional(),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

export const aiConfigSchema = z.object({
  provider: z.enum(['mock', 'azure-openai', 'bedrock', 'openai-compatible']).optional(),
  modelPrimary: z.string().max(100).optional(),
  modelLight: z.string().max(100).optional(),
  externalAiAllowed: z.boolean().optional(),
  phiRedactionEnabled: z.boolean().optional(),
  requireClinicianApproval: z.boolean().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().min(256).max(8192).optional(),
  /** Per-workflow enable switch. */
  workflows: z.record(z.enum(AI_WORKFLOWS), z.boolean()).optional(),
});
export type AiConfigInput = z.infer<typeof aiConfigSchema>;

export const upsertPromptTemplateSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]{3,60}$/),
  workflow: z.enum(AI_WORKFLOWS),
  systemPrompt: z.string().min(20).max(20_000),
  userTemplate: z.string().min(5).max(20_000),
  description: z.string().max(500).optional(),
  activate: z.boolean().default(false),
});
export type UpsertPromptTemplateInput = z.infer<typeof upsertPromptTemplateSchema>;

export const featureFlagSchema = z.object({
  key: z.string().regex(/^FEATURE_[A-Z_]{3,50}$/),
  enabled: z.boolean(),
  organizationId: z.string().uuid().nullable().optional(),
});

export const auditLogQuerySchema = paginationQuerySchema.extend({
  actorId: z.string().uuid().optional(),
  action: z.string().max(60).optional(),
  resource: z.string().max(60).optional(),
  resourceId: z.string().max(64).optional(),
  patientId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
