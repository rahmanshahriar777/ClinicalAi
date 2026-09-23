import { z } from 'zod';

/**
 * Environment validation. The API refuses to boot with an invalid or
 * dangerous configuration (e.g. default JWT secret in production, external
 * AI enabled without redaction, missing keys for a selected provider).
 */
const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().default(4000),
    API_URL: z.string().url().default('http://localhost:4000'),
    WEB_URL: z.string().url().default('http://localhost:3000'),
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    REQUEST_BODY_LIMIT: z.string().default('1mb'),

    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    JOBS_INLINE: bool.default(false),

    S3_ENDPOINT: z.string().optional(),
    S3_BUCKET: z.string().default('clinical-documents'),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_FORCE_PATH_STYLE: bool.default(true),

    AUTH_MODE: z.enum(['local', 'oidc']).default('local'),
    AUTH_ISSUER: z.string().optional(),
    AUTH_CLIENT_ID: z.string().optional(),
    AUTH_AUDIENCE: z.string().optional(),
    AUTH_OIDC_JIT_PROVISION: bool.default(false),
    JWT_SECRET: z.string().min(32).default('change-me-to-a-64-char-random-string-before-running-anything-real'),
    JWT_ACCESS_TTL: z.string().regex(/^\d+[smhd]$/).default('15m'),
    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    MFA_ISSUER_NAME: z.string().default('Clinical AI Platform'),
    FIELD_ENCRYPTION_KEY: z.string().optional(),

    AI_PROVIDER: z.enum(['mock', 'azure-openai', 'bedrock', 'openai-compatible']).default('mock'),
    AI_FALLBACK_PROVIDER: z.enum(['', 'mock', 'azure-openai', 'bedrock', 'openai-compatible']).default(''),
    AI_MODEL_PRIMARY: z.string().default('gpt-4o'),
    AI_MODEL_LIGHT: z.string().default('gpt-4o-mini'),
    AZURE_OPENAI_ENDPOINT: z.string().optional(),
    AZURE_OPENAI_API_KEY: z.string().optional(),
    AZURE_OPENAI_DEPLOYMENT: z.string().optional(),
    AZURE_OPENAI_API_VERSION: z.string().default('2024-10-21'),
    AWS_REGION: z.string().default('us-east-1'),
    BEDROCK_MODEL_ID: z.string().optional(),
    OPENAI_COMPATIBLE_BASE_URL: z.string().optional(),
    OPENAI_COMPATIBLE_API_KEY: z.string().optional(),
    OPENAI_COMPATIBLE_MODEL: z.string().optional(),
    AI_MAX_TOKENS: z.coerce.number().int().default(2048),
    AI_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.2),
    AI_TIMEOUT_MS: z.coerce.number().int().default(45_000),
    AI_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(1),
    PHI_REDACTOR: z.enum(['rules', 'presidio']).default('rules'),
    PRESIDIO_ANALYZER_URL: z.string().optional(),
    PRESIDIO_ANONYMIZER_URL: z.string().optional(),

    ENABLE_PHI_REDACTION: bool.default(true),
    EXTERNAL_AI_ALLOWED: bool.default(false),
    REQUIRE_CLINICIAN_APPROVAL: bool.default(true),

    FEATURE_PATIENT_MESSAGING: bool.default(true),
    FEATURE_AI_NOTES: bool.default(true),
    FEATURE_AI_MESSAGE_DRAFTS: bool.default(true),
    FEATURE_SPEECH_TO_TEXT: bool.default(false),
    FEATURE_PATIENT_EDUCATION: bool.default(false),

    NOTIFY_EMAIL_PROVIDER: z.enum(['log']).default('log'),
    NOTIFY_PUSH_PROVIDER: z.enum(['log', 'expo']).default('log'),
    NOTIFY_SMS_PROVIDER: z.enum(['log']).default('log'),
    EXPO_ACCESS_TOKEN: z.string().optional(),

    OTEL_ENABLED: bool.default(false),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
    OTEL_SERVICE_NAME: z.string().default('clinical-api'),
    SENTRY_DSN: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const isProd = env.NODE_ENV === 'production';
    if (isProd && env.AUTH_MODE === 'local' && env.JWT_SECRET.startsWith('change-me')) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'Default JWT_SECRET is not allowed in production' });
    }
    if (env.AUTH_MODE === 'oidc' && !env.AUTH_ISSUER) {
      ctx.addIssue({ code: 'custom', path: ['AUTH_ISSUER'], message: 'AUTH_ISSUER is required when AUTH_MODE=oidc' });
    }
    if (env.AI_PROVIDER === 'azure-openai' && !(env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_API_KEY && env.AZURE_OPENAI_DEPLOYMENT)) {
      ctx.addIssue({ code: 'custom', path: ['AI_PROVIDER'], message: 'azure-openai requires AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY and AZURE_OPENAI_DEPLOYMENT' });
    }
    if (env.AI_PROVIDER === 'bedrock' && !env.BEDROCK_MODEL_ID) {
      ctx.addIssue({ code: 'custom', path: ['BEDROCK_MODEL_ID'], message: 'bedrock requires BEDROCK_MODEL_ID' });
    }
    if (env.AI_PROVIDER === 'openai-compatible' && !(env.OPENAI_COMPATIBLE_BASE_URL && env.OPENAI_COMPATIBLE_MODEL)) {
      ctx.addIssue({ code: 'custom', path: ['AI_PROVIDER'], message: 'openai-compatible requires OPENAI_COMPATIBLE_BASE_URL and OPENAI_COMPATIBLE_MODEL' });
    }
    if (isProd && env.EXTERNAL_AI_ALLOWED && !env.ENABLE_PHI_REDACTION) {
      ctx.addIssue({ code: 'custom', path: ['ENABLE_PHI_REDACTION'], message: 'External AI without PHI redaction is not permitted in production (blueprint §11.5)' });
    }
    if (isProd && env.AI_PROVIDER === 'mock') {
      ctx.addIssue({ code: 'custom', path: ['AI_PROVIDER'], message: 'The mock AI provider cannot be used in production' });
    }
    if (env.PHI_REDACTOR === 'presidio' && !(env.PRESIDIO_ANALYZER_URL && env.PRESIDIO_ANONYMIZER_URL)) {
      ctx.addIssue({ code: 'custom', path: ['PHI_REDACTOR'], message: 'presidio redactor requires analyzer and anonymizer URLs' });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper — clears the cached env. */
export function resetEnvCache(): void {
  cached = undefined;
}

export const ENV = Symbol('ENV');
