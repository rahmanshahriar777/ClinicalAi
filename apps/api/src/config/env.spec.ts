import { loadEnv, resetEnvCache } from './env';

const base = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 's'.repeat(64) };

describe('environment validation', () => {
  beforeEach(() => resetEnvCache());

  it('applies safe defaults', () => {
    const env = loadEnv(base as NodeJS.ProcessEnv);
    expect(env.AI_PROVIDER).toBe('mock');
    expect(env.EXTERNAL_AI_ALLOWED).toBe(false);
    expect(env.ENABLE_PHI_REDACTION).toBe(true);
    expect(env.REQUIRE_CLINICIAN_APPROVAL).toBe(true);
  });

  it('refuses the mock provider and default secret in production', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', JWT_SECRET: 'change-me-to-a-64-char-random-string-before-running-anything-real' } as NodeJS.ProcessEnv)).toThrow(/JWT_SECRET/);
    resetEnvCache();
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(/mock AI provider/);
  });

  it('refuses external AI without redaction in production (§11.5)', () => {
    expect(() =>
      loadEnv({ ...base, NODE_ENV: 'production', AI_PROVIDER: 'openai-compatible', OPENAI_COMPATIBLE_BASE_URL: 'http://llm', OPENAI_COMPATIBLE_MODEL: 'm', EXTERNAL_AI_ALLOWED: 'true', ENABLE_PHI_REDACTION: 'false' } as NodeJS.ProcessEnv),
    ).toThrow(/PHI redaction/);
  });

  it('requires provider credentials for the selected provider', () => {
    expect(() => loadEnv({ ...base, AI_PROVIDER: 'azure-openai' } as NodeJS.ProcessEnv)).toThrow(/azure-openai requires/);
  });
});
